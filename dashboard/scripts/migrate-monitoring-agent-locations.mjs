import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(`
    create table if not exists monitoring_agent_locations (
      id serial primary key,
      agent_id integer not null references monitoring_agents(id) on delete cascade,
      location_id integer not null references locations(id) on delete cascade,
      created_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create unique index if not exists monitoring_agent_locations_agent_location_unique
      on monitoring_agent_locations(agent_id, location_id)
  `);
  await client.query(`
    create index if not exists monitoring_agent_locations_location_idx
      on monitoring_agent_locations(location_id)
  `);
  const backfill = await client.query(`
    insert into monitoring_agent_locations (agent_id, location_id)
    select id, location_id
    from monitoring_agents
    where location_id is not null
    on conflict (agent_id, location_id) do nothing
  `);
  const headOfficeCoverage = await client.query(`
    insert into monitoring_agent_locations (agent_id, location_id)
    select agent.id, location.id
    from monitoring_agents agent
    cross join locations location
    where agent.agent_key = 'head-office-agent'
      and location.name in (
        'Taipan Head Office - 2nd Floor',
        'Taipan Head Office - 7th Floor',
        'Taipan Head Office - 10th Floor',
        'Taipan Head Office - 19th Floor',
        'Taipan Head Office - 22nd Floor'
      )
    on conflict (agent_id, location_id) do nothing
  `);
  await client.query("commit");
  console.log(
    `Monitoring agent locations ready; backfilled ${backfill.rowCount ?? 0} primary location(s) ` +
    `and added ${headOfficeCoverage.rowCount ?? 0} Head Office coverage location(s).`,
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
