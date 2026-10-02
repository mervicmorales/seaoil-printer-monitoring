import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(`
    create table if not exists monitoring_agent_offices (
      id serial primary key,
      agent_id integer not null references monitoring_agents(id) on delete cascade,
      office_id integer not null references offices(id) on delete cascade,
      created_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create unique index if not exists monitoring_agent_offices_agent_office_unique
      on monitoring_agent_offices(agent_id, office_id)
  `);
  await client.query(`
    create index if not exists monitoring_agent_offices_office_idx
      on monitoring_agent_offices(office_id)
  `);
  const backfill = await client.query(`
    insert into monitoring_agent_offices (agent_id, office_id)
    select id, office_id
    from monitoring_agents
    where office_id is not null
    on conflict (agent_id, office_id) do nothing
  `);
  const headOfficeCoverage = await client.query(`
    insert into monitoring_agent_offices (agent_id, office_id)
    select agent.id, office.id
    from monitoring_agents agent
    cross join offices office
    where agent.agent_key = 'head-office-agent'
      and office.name in (
        'Taipan Head Office - 2nd Floor',
        'Taipan Head Office - 7th Floor',
        'Taipan Head Office - 10th Floor',
        'Taipan Head Office - 19th Floor',
        'Taipan Head Office - 22nd Floor'
      )
    on conflict (agent_id, office_id) do nothing
  `);
  await client.query("commit");
  console.log(
    `Monitoring agent offices ready; backfilled ${backfill.rowCount ?? 0} primary office(s) ` +
    `and added ${headOfficeCoverage.rowCount ?? 0} Head Office coverage record(s).`,
  );
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
