import pg from "pg";
import "dotenv/config";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const sql = `
do $$
begin
  if to_regclass('public.locations') is not null and to_regclass('public.offices') is not null then
    raise exception 'Both locations and offices tables exist; refusing to risk splitting organizational data.';
  end if;
  if to_regclass('public.locations') is not null then
    alter table locations rename to offices;
  end if;
end $$;

do $$
begin
  if to_regclass('public.monitoring_agent_locations') is not null and to_regclass('public.monitoring_agent_offices') is not null then
    raise exception 'Both monitoring agent coverage tables exist; refusing to risk splitting coverage data.';
  end if;
  if to_regclass('public.monitoring_agent_locations') is not null then
    alter table monitoring_agent_locations rename to monitoring_agent_offices;
  end if;
end $$;

do $$
declare
  item record;
begin
  for item in select * from (values
    ('users', 'primary_location_id', 'primary_office_id'),
    ('user_registration_requests', 'primary_location_id', 'primary_office_id'),
    ('printers', 'location_id', 'office_id'),
    ('monitoring_agents', 'location_id', 'office_id'),
    ('monitoring_agent_offices', 'location_id', 'office_id'),
    ('organization_mappings', 'location_id', 'office_id'),
    ('repair_tickets', 'location_id', 'office_id'),
    ('toner_transactions', 'location_id', 'office_id')
  ) as columns_to_rename(table_name, old_name, new_name)
  loop
    if to_regclass('public.' || item.table_name) is not null
      and exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = item.table_name and column_name = item.old_name
      )
      and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = item.table_name and column_name = item.new_name
      )
    then
      execute format('alter table %I rename column %I to %I', item.table_name, item.old_name, item.new_name);
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.locations_id_seq') is not null and to_regclass('public.offices_id_seq') is null then
    alter sequence locations_id_seq rename to offices_id_seq;
  end if;
end $$;

alter index if exists locations_name_lower_unique rename to offices_name_lower_unique;
alter index if exists organization_mappings_location_idx rename to organization_mappings_office_idx;
alter index if exists monitoring_agents_location_idx rename to monitoring_agents_office_idx;
alter index if exists monitoring_agent_locations_agent_location_unique rename to monitoring_agent_offices_agent_office_unique;
alter index if exists monitoring_agent_locations_location_idx rename to monitoring_agent_offices_office_idx;
`;

try {
  await client.query("begin");
  await client.query(sql);
  const verification = await client.query(`
    select
      to_regclass('public.offices')::text as offices_table,
      to_regclass('public.locations')::text as legacy_locations_table,
      to_regclass('public.monitoring_agent_locations')::text as legacy_agent_offices_table,
      count(*) filter (
        where (table_name, column_name) in (
          ('users', 'primary_location_id'),
          ('user_registration_requests', 'primary_location_id'),
          ('printers', 'location_id'),
          ('monitoring_agents', 'location_id'),
          ('monitoring_agent_offices', 'location_id'),
          ('organization_mappings', 'location_id'),
          ('repair_tickets', 'location_id'),
          ('toner_transactions', 'location_id')
        )
      )::int as legacy_column_count
    from information_schema.columns
    where table_schema = 'public'
  `);
  const state = verification.rows[0];
  if (state.legacy_locations_table || state.legacy_agent_offices_table || state.legacy_column_count > 0) {
    throw new Error("Office naming verification failed because legacy database identifiers remain");
  }
  await client.query("commit");
  console.log(
    state.offices_table
      ? "Office naming migration verified; existing organizational data was preserved."
      : "Office naming migration is ready; no existing organization tables required renaming.",
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
