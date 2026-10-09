import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  databaseSizeLabel,
  nextRetentionRun,
  retentionDisplayConfig,
  retentionHealth,
} from "@/lib/monitoring-retention-display";

type RunResult = Record<string, unknown>;

type RetentionRunRow = {
  id: number;
  status: string;
  dry_run: boolean;
  result: RunResult;
  error_message: string | null;
  started_at: Date | string;
  completed_at: Date | string | null;
};

type RetentionStatsRow = {
  hourly_summaries: string;
  daily_summaries: string;
  raw_monitoring_readings: string;
  raw_consumable_readings: string;
  open_alerts: string;
  resolved_alerts: string;
  earliest_hourly: Date | string | null;
  latest_hourly: Date | string | null;
  earliest_daily: string | null;
  latest_daily: string | null;
};

function resultNumber(result: RunResult | null, key: string) {
  const value = result?.[key];
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function asDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function getMonitoringRetentionStatus(now = new Date()) {
  const config = retentionDisplayConfig();
  const databaseSizeResult = await db.execute<{ bytes: string }>(sql`
    select pg_database_size(current_database())::text as bytes
  `);
  const databaseBytes = Number(databaseSizeResult.rows[0]?.bytes ?? 0);

  try {
    const [runsResult, successfulResult, statsResult] = await Promise.all([
      db.execute<RetentionRunRow>(sql`
        select id, status, dry_run, result, error_message, started_at, completed_at
        from monitoring_retention_runs
        order by started_at desc, id desc
        limit 10
      `),
      db.execute<{ completed_at: Date | string }>(sql`
        select completed_at
        from monitoring_retention_runs
        where status = 'completed' and completed_at is not null
        order by completed_at desc, id desc
        limit 1
      `),
      db.execute<RetentionStatsRow>(sql`
        select
          (select count(*)::text from printer_monitoring_hourly) as hourly_summaries,
          (select count(*)::text from printer_consumable_daily) as daily_summaries,
          (select count(*)::text from printer_monitoring_readings) as raw_monitoring_readings,
          (select count(*)::text from printer_consumable_readings) as raw_consumable_readings,
          (select count(*)::text from printer_alerts where resolved_at is null) as open_alerts,
          (select count(*)::text from printer_alerts where resolved_at is not null) as resolved_alerts,
          (select min(bucket_start) from printer_monitoring_hourly) as earliest_hourly,
          (select max(bucket_start) from printer_monitoring_hourly) as latest_hourly,
          (select min(bucket_date)::text from printer_consumable_daily) as earliest_daily,
          (select max(bucket_date)::text from printer_consumable_daily) as latest_daily
      `),
    ]);

    const runs = runsResult.rows.map((run) => ({
      ...run,
      started_at: asDate(run.started_at) ?? now,
      completed_at: asDate(run.completed_at),
    }));
    const latestRun = runs[0] ?? null;
    const latestCompletedAt = asDate(successfulResult.rows[0]?.completed_at);
    const stats = statsResult.rows[0];
    const nextRun = nextRetentionRun(now, config);
    const health = retentionHealth(config.enabled, latestRun?.status ?? null, latestCompletedAt, now);
    const latestResult = latestRun?.result ?? null;

    return {
      initialized: true as const,
      config,
      health,
      databaseBytes,
      databaseSize: databaseSizeLabel(databaseBytes),
      nextRun,
      latestCompletedAt,
      latestRun,
      recentRuns: runs,
      summaries: {
        hourly: Number(stats?.hourly_summaries ?? 0),
        daily: Number(stats?.daily_summaries ?? 0),
        earliestHourly: asDate(stats?.earliest_hourly),
        latestHourly: asDate(stats?.latest_hourly),
        earliestDaily: stats?.earliest_daily ?? null,
        latestDaily: stats?.latest_daily ?? null,
      },
      currentRecords: {
        monitoring: Number(stats?.raw_monitoring_readings ?? 0),
        consumables: Number(stats?.raw_consumable_readings ?? 0),
        openAlerts: Number(stats?.open_alerts ?? 0),
        resolvedAlerts: Number(stats?.resolved_alerts ?? 0),
      },
      latestCounts: {
        hourlyWritten: resultNumber(latestResult, "monitoringHourlyRowsWritten"),
        dailyWritten: resultNumber(latestResult, "consumableDailyRowsWritten"),
        monitoringDeleted: resultNumber(latestResult, "monitoringReadingsDeleted"),
        alertsDeleted: resultNumber(latestResult, "resolvedAlertsDeleted"),
      },
    };
  } catch (error) {
    if ((error as { code?: string }).code !== "42P01") throw error;
    return {
      initialized: false as const,
      config,
      health: config.enabled ? ("waiting" as const) : ("disabled" as const),
      databaseBytes,
      databaseSize: databaseSizeLabel(databaseBytes),
      nextRun: nextRetentionRun(now, config),
      latestCompletedAt: null,
      latestRun: null,
      recentRuns: [],
      summaries: {
        hourly: 0,
        daily: 0,
        earliestHourly: null,
        latestHourly: null,
        earliestDaily: null,
        latestDaily: null,
      },
      currentRecords: {
        monitoring: 0,
        consumables: 0,
        openAlerts: 0,
        resolvedAlerts: 0,
      },
      latestCounts: {
        hourlyWritten: 0,
        dailyWritten: 0,
        monitoringDeleted: 0,
        alertsDeleted: 0,
      },
    };
  }
}

export type MonitoringRetentionStatus = Awaited<ReturnType<typeof getMonitoringRetentionStatus>>;
