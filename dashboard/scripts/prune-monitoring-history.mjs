import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { retentionConfig } from "./monitoring-retention-config.mjs";

const ADVISORY_LOCK_KEY = "sea-print-monitoring-retention-v1";

async function deleteInBatches(client, query, cutoff, batchSize) {
  let deleted = 0;
  while (true) {
    const result = await client.query(query, [cutoff, batchSize]);
    const batchCount = result.rowCount ?? 0;
    deleted += batchCount;
    if (batchCount < batchSize) return deleted;
  }
}

export async function runMonitoringRetention({
  environment = process.env,
  dryRun = false,
  logger = console,
} = {}) {
  if (!environment.DATABASE_URL) throw new Error("DATABASE_URL is required");

  const config = retentionConfig(environment);
  const pool = new pg.Pool({
    connectionString: environment.DATABASE_URL,
    application_name: "sea-print-monitoring-retention",
    max: 1,
  });
  const client = await pool.connect();
  let locked = false;
  let runId = null;

  try {
    const lockResult = await client.query(
      "select pg_try_advisory_lock(hashtext($1)) as locked",
      [ADVISORY_LOCK_KEY],
    );
    locked = lockResult.rows[0]?.locked === true;
    if (!locked) {
      logger.warn("Monitoring retention skipped because another worker holds the lock.");
      return { status: "skipped", reason: "already-running" };
    }

    const cutoffResult = await client.query(
      `
        select
          (
            date_trunc('day', now() at time zone $1)
            - ($2::integer * interval '1 day')
          ) at time zone $1 as raw_cutoff,
          (
            (date_trunc('day', now() at time zone $1))::date
            - $3::integer
          )::text as summary_cutoff,
          now() - ($4::integer * interval '1 day') as alert_cutoff
      `,
      [
        config.timezone,
        config.rawRetentionDays,
        config.summaryRetentionDays,
        config.resolvedAlertRetentionDays,
      ],
    );
    const { raw_cutoff: rawCutoff, summary_cutoff: summaryCutoff, alert_cutoff: alertCutoff } =
      cutoffResult.rows[0];

    const runResult = await client.query(
      `
        insert into monitoring_retention_runs (
          status,
          dry_run,
          raw_retention_days,
          summary_retention_days,
          resolved_alert_retention_days
        ) values ('running', $1, $2, $3, $4)
        returning id
      `,
      [
        dryRun,
        config.rawRetentionDays,
        config.summaryRetentionDays,
        config.resolvedAlertRetentionDays,
      ],
    );
    runId = runResult.rows[0].id;

    const eligibleResult = await client.query(
      `
        select
          count(*)::bigint as monitoring_readings,
          coalesce(sum((
            select count(*)
            from printer_consumable_readings consumable
            where consumable.monitoring_reading_id = reading.id
          )), 0)::bigint as consumable_readings
        from printer_monitoring_readings reading
        where reading.checked_at < $1
          and not exists (
            select 1
            from printer_current_status current_status
            where current_status.monitoring_reading_id = reading.id
          )
      `,
      [rawCutoff],
    );
    const eligibleAlertsResult = await client.query(
      `
        select count(*)::bigint as resolved_alerts
        from printer_alerts
        where resolved_at is not null
          and resolved_at < $1
      `,
      [alertCutoff],
    );

    const result = {
      rawCutoff: new Date(rawCutoff).toISOString(),
      summaryCutoff,
      alertCutoff: new Date(alertCutoff).toISOString(),
      eligibleMonitoringReadings: Number(eligibleResult.rows[0].monitoring_readings),
      eligibleConsumableReadings: Number(eligibleResult.rows[0].consumable_readings),
      eligibleResolvedAlerts: Number(eligibleAlertsResult.rows[0].resolved_alerts),
      monitoringHourlyRowsWritten: 0,
      consumableDailyRowsWritten: 0,
      monitoringReadingsDeleted: 0,
      resolvedAlertsDeleted: 0,
      monitoringHourlyRowsDeleted: 0,
      consumableDailyRowsDeleted: 0,
    };

    if (!dryRun) {
      const monitoringSummary = await client.query(
        `
          insert into printer_monitoring_hourly (
            printer_id,
            bucket_start,
            sample_count,
            online_count,
            offline_count,
            error_count,
            average_response_time_ms,
            minimum_page_count,
            maximum_page_count,
            last_page_count,
            maximum_uptime_seconds,
            last_printer_status,
            updated_at
          )
          select
            reading.printer_id,
            date_trunc('hour', reading.checked_at at time zone 'UTC') at time zone 'UTC',
            count(*)::integer,
            count(*) filter (where reading.online)::integer,
            count(*) filter (where not reading.online)::integer,
            count(*) filter (
              where nullif(trim(reading.error_status), '') is not null
                 or nullif(trim(reading.error_message), '') is not null
            )::integer,
            round(avg(reading.response_time_ms))::integer,
            min(reading.page_count),
            max(reading.page_count),
            (array_agg(reading.page_count order by reading.checked_at desc, reading.id desc)
              filter (where reading.page_count is not null))[1],
            max(reading.uptime_seconds),
            (array_agg(reading.printer_status order by reading.checked_at desc, reading.id desc)
              filter (where reading.printer_status is not null))[1],
            now()
          from printer_monitoring_readings reading
          where reading.checked_at < $1
            and not exists (
              select 1
              from printer_current_status current_status
              where current_status.monitoring_reading_id = reading.id
            )
          group by
            reading.printer_id,
            date_trunc('hour', reading.checked_at at time zone 'UTC') at time zone 'UTC'
          on conflict (printer_id, bucket_start) do update set
            sample_count = excluded.sample_count,
            online_count = excluded.online_count,
            offline_count = excluded.offline_count,
            error_count = excluded.error_count,
            average_response_time_ms = excluded.average_response_time_ms,
            minimum_page_count = excluded.minimum_page_count,
            maximum_page_count = excluded.maximum_page_count,
            last_page_count = excluded.last_page_count,
            maximum_uptime_seconds = excluded.maximum_uptime_seconds,
            last_printer_status = excluded.last_printer_status,
            updated_at = now()
        `,
        [rawCutoff],
      );
      result.monitoringHourlyRowsWritten = monitoringSummary.rowCount ?? 0;

      const consumableSummary = await client.query(
        `
          insert into printer_consumable_daily (
            printer_id,
            name,
            type,
            bucket_date,
            sample_count,
            minimum_level_percent,
            maximum_level_percent,
            average_level_percent,
            last_level_percent,
            warning_count,
            unknown_count,
            last_status,
            updated_at
          )
          select
            consumable.printer_id,
            consumable.name,
            consumable.type,
            (consumable.checked_at at time zone $2)::date,
            count(*)::integer,
            min(consumable.level_percent),
            max(consumable.level_percent),
            round(avg(consumable.level_percent))::integer,
            (array_agg(consumable.level_percent order by consumable.checked_at desc, consumable.id desc)
              filter (where consumable.level_percent is not null))[1],
            count(*) filter (
              where lower(coalesce(consumable.status, '')) similar to '%(low|warning|critical|empty|replace)%'
            )::integer,
            count(*) filter (where consumable.is_unknown)::integer,
            (array_agg(consumable.status order by consumable.checked_at desc, consumable.id desc)
              filter (where consumable.status is not null))[1],
            now()
          from printer_consumable_readings consumable
          inner join printer_monitoring_readings reading
            on reading.id = consumable.monitoring_reading_id
          where reading.checked_at < $1
            and not exists (
              select 1
              from printer_current_status current_status
              where current_status.monitoring_reading_id = reading.id
            )
          group by
            consumable.printer_id,
            consumable.name,
            consumable.type,
            (consumable.checked_at at time zone $2)::date
          on conflict (printer_id, name, type, bucket_date) do update set
            sample_count = excluded.sample_count,
            minimum_level_percent = excluded.minimum_level_percent,
            maximum_level_percent = excluded.maximum_level_percent,
            average_level_percent = excluded.average_level_percent,
            last_level_percent = excluded.last_level_percent,
            warning_count = excluded.warning_count,
            unknown_count = excluded.unknown_count,
            last_status = excluded.last_status,
            updated_at = now()
        `,
        [rawCutoff, config.timezone],
      );
      result.consumableDailyRowsWritten = consumableSummary.rowCount ?? 0;

      result.monitoringReadingsDeleted = await deleteInBatches(
        client,
        `
          with doomed as (
            select reading.id
            from printer_monitoring_readings reading
            where reading.checked_at < $1
              and not exists (
                select 1
                from printer_current_status current_status
                where current_status.monitoring_reading_id = reading.id
              )
            order by reading.checked_at, reading.id
            limit $2
          )
          delete from printer_monitoring_readings reading
          using doomed
          where reading.id = doomed.id
        `,
        rawCutoff,
        config.deleteBatchSize,
      );

      result.resolvedAlertsDeleted = await deleteInBatches(
        client,
        `
          with doomed as (
            select id
            from printer_alerts
            where resolved_at is not null
              and resolved_at < $1
            order by resolved_at, id
            limit $2
          )
          delete from printer_alerts alert
          using doomed
          where alert.id = doomed.id
        `,
        alertCutoff,
        config.deleteBatchSize,
      );

      const hourlyDeletion = await client.query(
        `
          delete from printer_monitoring_hourly
          where bucket_start < ($1::date::timestamp at time zone $2)
        `,
        [summaryCutoff, config.timezone],
      );
      result.monitoringHourlyRowsDeleted = hourlyDeletion.rowCount ?? 0;
      const dailyDeletion = await client.query(
        "delete from printer_consumable_daily where bucket_date < $1",
        [summaryCutoff],
      );
      result.consumableDailyRowsDeleted = dailyDeletion.rowCount ?? 0;

      await client.query("analyze printer_monitoring_readings");
      await client.query("analyze printer_consumable_readings");
      await client.query("analyze printer_alerts");
    }

    await client.query(
      `
        update monitoring_retention_runs
        set status = $2,
            result = $3::jsonb,
            completed_at = now()
        where id = $1
      `,
      [runId, dryRun ? "dry-run" : "completed", JSON.stringify(result)],
    );
    logger.log(JSON.stringify({ status: dryRun ? "dry-run" : "completed", ...result }, null, 2));
    return { status: dryRun ? "dry-run" : "completed", ...result };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId !== null) {
      await client
        .query(
          `
            update monitoring_retention_runs
            set status = 'failed', error_message = $2, completed_at = now()
            where id = $1
          `,
          [runId, message.slice(0, 4000)],
        )
        .catch(() => undefined);
    }
    await client
      .query(
        `
          insert into notifications (message, type)
          values ($1, 'monitoring-retention-failed')
        `,
        [`Monitoring retention cleanup failed: ${message.slice(0, 500)}`],
      )
      .catch(() => undefined);
    throw error;
  } finally {
    if (locked) {
      await client
        .query("select pg_advisory_unlock(hashtext($1))", [ADVISORY_LOCK_KEY])
        .catch(() => undefined);
    }
    client.release();
    await pool.end();
  }
}

const isMainModule = process.argv[1]
  ? fileURLToPath(import.meta.url) === resolve(process.argv[1])
  : false;

if (isMainModule) {
  runMonitoringRetention({ dryRun: process.argv.includes("--dry-run") }).catch((error) => {
    console.error("Monitoring retention failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
