import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const db = drizzle(pool);
  await db.execute(sql`alter table printers add column if not exists floor text`);
  console.log("Optional printer floor column is ready.");
} finally {
  await pool.end();
}
