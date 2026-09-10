import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(`
    create table if not exists printer_access_requests (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      agent_id integer not null references monitoring_agents(id) on delete cascade,
      printer_id integer not null references printers(id) on delete cascade,
      status text not null default 'pending',
      requested_at timestamptz not null default now(),
      reviewed_by integer references users(id) on delete set null,
      reviewed_at timestamptz,
      updated_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create unique index if not exists printer_access_requests_user_printer_unique
      on printer_access_requests(user_id, printer_id)
  `);
  await client.query(`
    create index if not exists printer_access_requests_status_idx
      on printer_access_requests(status, requested_at)
  `);
  await client.query("commit");
  console.log("Printer access requests are ready.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
