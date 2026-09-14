import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  const db = drizzle(pool);
  await db.execute(sql`
    alter table monitoring_agents
      add column if not exists platform text,
      add column if not exists architecture text,
      add column if not exists node_version text,
      add column if not exists agent_uptime_seconds bigint,
      add column if not exists build_identifier text,
      add column if not exists last_successful_upload_at timestamptz,
      add column if not exists last_matched_printer_count integer,
      add column if not exists last_unmatched_printer_count integer
  `);
  console.log("Monitoring agent management columns are ready.");
} finally {
  await pool.end();
}
