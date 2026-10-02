import pg from "pg";
import "dotenv/config";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

const sql = `
alter table offices add column if not exists address text;
alter table offices add column if not exists status text not null default 'active';
alter table offices add column if not exists updated_at timestamp not null default now();
create unique index if not exists offices_name_lower_unique on offices(lower(name));

alter table departments add column if not exists status text not null default 'active';
alter table departments add column if not exists updated_at timestamp not null default now();
create unique index if not exists departments_name_lower_unique on departments(lower(name));

create table if not exists subunits (
  id serial primary key,
  department_id integer not null references departments(id) on delete restrict,
  name text not null,
  status text not null default 'active',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create unique index if not exists subunits_department_name_unique on subunits(department_id, name);
create unique index if not exists subunits_department_name_lower_unique on subunits(department_id, lower(name));
create index if not exists subunits_department_status_idx on subunits(department_id, status);

create table if not exists cost_centers (
  id serial primary key,
  code text not null unique,
  status text not null default 'active',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create unique index if not exists cost_centers_code_lower_unique on cost_centers(lower(code));

create table if not exists organization_mappings (
  id serial primary key,
  office_id integer not null references offices(id) on delete restrict,
  subunit_id integer not null references subunits(id) on delete restrict,
  cost_center_id integer not null references cost_centers(id) on delete restrict,
  status text not null default 'active',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);
create unique index if not exists organization_mappings_unique on organization_mappings(office_id, subunit_id, cost_center_id);
create index if not exists organization_mappings_office_idx on organization_mappings(office_id);
create index if not exists organization_mappings_subunit_idx on organization_mappings(subunit_id);
create index if not exists organization_mappings_cost_center_idx on organization_mappings(cost_center_id);

alter table users add column if not exists subunit_id integer references subunits(id) on delete set null;
alter table users add column if not exists cost_center_id integer references cost_centers(id) on delete set null;
alter table printers add column if not exists subunit_id integer references subunits(id) on delete set null;
alter table printers add column if not exists cost_center_id integer references cost_centers(id) on delete set null;
alter table repair_tickets add column if not exists subunit_id integer references subunits(id) on delete set null;
alter table repair_tickets add column if not exists cost_center_id integer references cost_centers(id) on delete set null;
alter table toner_transactions add column if not exists subunit_id integer references subunits(id) on delete set null;
alter table toner_transactions add column if not exists cost_center_id integer references cost_centers(id) on delete set null;
alter table user_registration_requests add column if not exists subunit_id integer references subunits(id) on delete set null;
alter table user_registration_requests add column if not exists cost_center_id integer references cost_centers(id) on delete set null;

create index if not exists users_subunit_idx on users(subunit_id);
create index if not exists users_cost_center_idx on users(cost_center_id);
create index if not exists printers_subunit_idx on printers(subunit_id);
create index if not exists printers_cost_center_idx on printers(cost_center_id);
create index if not exists repair_tickets_subunit_idx on repair_tickets(subunit_id);
create index if not exists repair_tickets_cost_center_idx on repair_tickets(cost_center_id);
create index if not exists toner_transactions_subunit_idx on toner_transactions(subunit_id);
create index if not exists toner_transactions_cost_center_idx on toner_transactions(cost_center_id);
create index if not exists registration_requests_subunit_idx on user_registration_requests(subunit_id);
create index if not exists registration_requests_cost_center_idx on user_registration_requests(cost_center_id);

create table if not exists organization_imports (
  id serial primary key,
  filename text not null,
  imported_by integer references users(id) on delete set null,
  status text not null default 'pending',
  total_rows integer not null default 0,
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  staged_rows jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists organization_imports_created_idx on organization_imports(created_at desc);
`;

try {
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log("Organization data migration complete.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
