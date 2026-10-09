import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(`
    create table if not exists printer_current_status (
      printer_id integer primary key references printers(id) on delete cascade,
      agent_id integer not null references monitoring_agents(id),
      monitoring_reading_id integer references printer_monitoring_readings(id) on delete set null,
      checked_at timestamptz not null,
      online boolean not null,
      printer_status text,
      response_time_ms integer,
      page_count bigint,
      uptime_seconds bigint,
      error_status text,
      error_message text,
      updated_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create index if not exists printer_current_status_checked_idx
      on printer_current_status(checked_at)
  `);

  await client.query(`
    create table if not exists printer_current_consumables (
      id serial primary key,
      printer_id integer not null references printers(id) on delete cascade,
      name text not null,
      type text not null,
      level_percent integer,
      status text,
      is_unknown boolean not null default false,
      checked_at timestamptz not null,
      updated_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create unique index if not exists printer_current_consumables_printer_name_type_unique
      on printer_current_consumables(printer_id, name, type)
  `);
  await client.query(`
    create index if not exists printer_current_consumables_printer_idx
      on printer_current_consumables(printer_id)
  `);

  await client.query(`
    create table if not exists printer_monitoring_hourly (
      id serial primary key,
      printer_id integer not null references printers(id) on delete cascade,
      bucket_start timestamptz not null,
      sample_count integer not null,
      online_count integer not null,
      offline_count integer not null,
      error_count integer not null,
      average_response_time_ms integer,
      minimum_page_count bigint,
      maximum_page_count bigint,
      last_page_count bigint,
      maximum_uptime_seconds bigint,
      last_printer_status text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create unique index if not exists printer_monitoring_hourly_printer_bucket_unique
      on printer_monitoring_hourly(printer_id, bucket_start)
  `);
  await client.query(`
    create index if not exists printer_monitoring_hourly_bucket_idx
      on printer_monitoring_hourly(bucket_start)
  `);

  await client.query(`
    create table if not exists printer_consumable_daily (
      id serial primary key,
      printer_id integer not null references printers(id) on delete cascade,
      name text not null,
      type text not null,
      bucket_date date not null,
      sample_count integer not null,
      minimum_level_percent integer,
      maximum_level_percent integer,
      average_level_percent integer,
      last_level_percent integer,
      warning_count integer not null,
      unknown_count integer not null,
      last_status text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create unique index if not exists printer_consumable_daily_printer_name_type_date_unique
      on printer_consumable_daily(printer_id, name, type, bucket_date)
  `);
  await client.query(`
    create index if not exists printer_consumable_daily_date_idx
      on printer_consumable_daily(bucket_date)
  `);

  await client.query(`
    create table if not exists monitoring_retention_runs (
      id serial primary key,
      status text not null,
      dry_run boolean not null default false,
      raw_retention_days integer not null,
      summary_retention_days integer not null,
      resolved_alert_retention_days integer not null,
      result jsonb not null default '{}'::jsonb,
      error_message text,
      started_at timestamptz not null default now(),
      completed_at timestamptz
    )
  `);
  await client.query(`
    create index if not exists monitoring_retention_runs_started_idx
      on monitoring_retention_runs(started_at)
  `);

  const currentStatuses = await client.query(`
    insert into printer_current_status (
      printer_id,
      agent_id,
      monitoring_reading_id,
      checked_at,
      online,
      printer_status,
      response_time_ms,
      page_count,
      uptime_seconds,
      error_status,
      error_message,
      updated_at
    )
    select distinct on (printer_id)
      printer_id,
      agent_id,
      id,
      checked_at,
      online,
      printer_status,
      response_time_ms,
      page_count,
      uptime_seconds,
      error_status,
      error_message,
      now()
    from printer_monitoring_readings
    order by printer_id, checked_at desc, id desc
    on conflict (printer_id) do update set
      agent_id = excluded.agent_id,
      monitoring_reading_id = excluded.monitoring_reading_id,
      checked_at = excluded.checked_at,
      online = excluded.online,
      printer_status = excluded.printer_status,
      response_time_ms = excluded.response_time_ms,
      page_count = excluded.page_count,
      uptime_seconds = excluded.uptime_seconds,
      error_status = excluded.error_status,
      error_message = excluded.error_message,
      updated_at = now()
    where excluded.checked_at >= printer_current_status.checked_at
  `);

  await client.query("delete from printer_current_consumables");
  const currentConsumables = await client.query(`
    with latest_readings as (
      select distinct on (printer_id) id, printer_id
      from printer_monitoring_readings
      order by printer_id, checked_at desc, id desc
    )
    insert into printer_current_consumables (
      printer_id,
      name,
      type,
      level_percent,
      status,
      is_unknown,
      checked_at,
      updated_at
    )
    select
      consumable.printer_id,
      consumable.name,
      consumable.type,
      consumable.level_percent,
      consumable.status,
      consumable.is_unknown,
      consumable.checked_at,
      now()
    from printer_consumable_readings consumable
    inner join latest_readings latest
      on latest.id = consumable.monitoring_reading_id
    on conflict (printer_id, name, type) do update set
      level_percent = excluded.level_percent,
      status = excluded.status,
      is_unknown = excluded.is_unknown,
      checked_at = excluded.checked_at,
      updated_at = now()
  `);

  await client.query("commit");
  console.log(
    `Monitoring retention schema is ready; refreshed ${currentStatuses.rowCount ?? 0} current status ` +
      `and ${currentConsumables.rowCount ?? 0} current consumable record(s).`,
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
