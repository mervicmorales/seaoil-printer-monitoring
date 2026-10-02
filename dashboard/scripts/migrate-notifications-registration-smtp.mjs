import pg from "pg";
import "dotenv/config";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
alter table toner_inventory add column if not exists critical_stock_threshold integer not null default 2;
alter table toner_inventory add column if not exists alert_state text not null default 'normal';
update toner_inventory set alert_state = case when stock <= 0 then 'empty' when stock <= critical_stock_threshold then 'critical' when stock <= low_stock_threshold then 'low' else 'normal' end;

alter table users add column if not exists employee_id text;
alter table users add column if not exists primary_office_id integer references offices(id) on delete set null;
alter table users add column if not exists department_id integer references departments(id) on delete set null;
alter table users add column if not exists account_status text not null default 'active';
alter table users add column if not exists email_verified_at timestamptz;
alter table users alter column role set default 'support';
update users set role = 'support' where role = 'user';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_employee_id_unique') then
    alter table users add constraint users_employee_id_unique unique(employee_id);
  end if;
end $$;

create table if not exists manual_user_verification_tokens (
  id serial primary key,
  user_id integer not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists manual_user_verification_user_idx on manual_user_verification_tokens(user_id);

alter table printer_discovery_scans drop constraint if exists printer_discovery_scans_requested_by_users_id_fk;
alter table printer_discovery_scans alter column requested_by drop not null;
alter table printer_discovery_scans add constraint printer_discovery_scans_requested_by_users_id_fk
  foreign key (requested_by) references users(id) on delete set null;

alter table print_ops_commands drop constraint if exists print_ops_commands_requested_by_users_id_fk;
alter table print_ops_commands alter column requested_by drop not null;
alter table print_ops_commands add constraint print_ops_commands_requested_by_users_id_fk
  foreign key (requested_by) references users(id) on delete set null;

create table if not exists user_registration_requests (
  id serial primary key,
  employee_id text,
  full_name text not null,
  email text not null,
  username text not null,
  password_hash text not null,
  primary_office_id integer references offices(id),
  department_id integer references departments(id),
  source text not null default 'self_registration',
  user_id integer references users(id) on delete set null,
  status text not null default 'pending_email',
  email_verified_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reviewed_by integer references users(id) on delete set null,
  reviewed_at timestamptz,
  rejection_reason text,
  deletion_reason text
);
alter table user_registration_requests alter column employee_id drop not null;
alter table user_registration_requests alter column primary_office_id drop not null;
alter table user_registration_requests alter column department_id drop not null;
alter table user_registration_requests add column if not exists source text not null default 'self_registration';
alter table user_registration_requests add column if not exists user_id integer references users(id) on delete set null;
alter table user_registration_requests add column if not exists deletion_reason text;
create index if not exists registration_requests_status_idx on user_registration_requests(status);
create index if not exists registration_requests_email_idx on user_registration_requests(email);
create index if not exists registration_requests_employee_idx on user_registration_requests(employee_id);
create index if not exists registration_requests_user_idx on user_registration_requests(user_id);

create table if not exists email_verification_tokens (
  id serial primary key,
  registration_request_id integer not null references user_registration_requests(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_verification_registration_idx on email_verification_tokens(registration_request_id);

create table if not exists audit_logs (
  id serial primary key,
  actor_user_id integer references users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on audit_logs(created_at);

alter table system_settings add column if not exists agent_offline_threshold_minutes integer not null default 5;
alter table system_settings add column if not exists toner_low_email_enabled boolean not null default true;
alter table system_settings add column if not exists toner_critical_email_enabled boolean not null default true;
alter table system_settings add column if not exists toner_empty_email_enabled boolean not null default true;
alter table system_settings add column if not exists agent_offline_email_enabled boolean not null default true;
alter table system_settings add column if not exists agent_recovered_email_enabled boolean not null default true;
alter table system_settings add column if not exists registration_enabled boolean not null default true;
alter table system_settings add column if not exists smtp_enabled boolean not null default false;
alter table system_settings add column if not exists smtp_host text;
alter table system_settings add column if not exists smtp_port integer;
alter table system_settings add column if not exists smtp_security text not null default 'none';
alter table system_settings add column if not exists smtp_username text;
alter table system_settings add column if not exists smtp_password_encrypted text;
alter table system_settings add column if not exists smtp_from text;
alter table system_settings add column if not exists smtp_from_name text;
alter table system_settings add column if not exists smtp_test_recipient text;
alter table system_settings add column if not exists smtp_last_tested_at timestamptz;
alter table system_settings add column if not exists updated_at timestamptz not null default now();
alter table system_settings add column if not exists updated_by integer references users(id) on delete set null;
`;

const client = await pool.connect();
try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("Notification, registration, and SMTP migration complete.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
