import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("alter table users add column if not exists session_version integer not null default 0");
  await pool.query(`
    create table if not exists auth_rate_limits (
      key text primary key,
      failures integer not null default 0,
      window_started_at timestamptz not null default now()
    )
  `);
  console.log("Authentication security columns and rate limits are ready.");
} finally {
  await pool.end();
}
