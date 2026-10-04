import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query("begin");
  await pool.query(`
    alter table users
    add column if not exists password_change_required boolean not null default false
  `);
  await pool.query(`
    alter table users
    add column if not exists temporary_password_expires_at timestamptz
  `);
  await pool.query("commit");
  console.log("Temporary password schema is ready.");
} catch (error) {
  await pool.query("rollback");
  throw error;
} finally {
  await pool.end();
}
