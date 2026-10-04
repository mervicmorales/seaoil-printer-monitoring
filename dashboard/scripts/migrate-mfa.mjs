import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query("begin");
  await pool.query("alter table users add column if not exists totp_secret_encrypted text");
  await pool.query("alter table users add column if not exists totp_pending_secret_encrypted text");
  await pool.query("alter table users add column if not exists totp_enabled_at timestamptz");
  await pool.query("alter table users add column if not exists totp_last_used_step bigint");
  await pool.query(`
    create table if not exists user_mfa_recovery_codes (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      code_hash text not null unique,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create index if not exists user_mfa_recovery_codes_user_idx
    on user_mfa_recovery_codes(user_id)
  `);
  await pool.query("commit");
  console.log("Authenticator MFA schema is ready.");
} catch (error) {
  await pool.query("rollback");
  throw error;
} finally {
  await pool.end();
}
