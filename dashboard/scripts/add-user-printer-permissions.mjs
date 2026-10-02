import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(`
    create table if not exists user_printer_permissions (
      id serial primary key,
      user_id integer not null references users(id) on delete cascade,
      agent_id integer not null references monitoring_agents(id) on delete cascade,
      printer_id integer not null references printers(id) on delete cascade,
      created_at timestamptz not null default now()
    )
  `);
  await client.query(`
    create unique index if not exists user_printer_permissions_user_printer_unique
      on user_printer_permissions(user_id, printer_id)
  `);
  await client.query(`
    create index if not exists user_printer_permissions_agent_idx
      on user_printer_permissions(agent_id)
  `);
  const backfill = await client.query(`
    insert into user_printer_permissions (user_id, agent_id, printer_id)
    select employee.id, assignment.agent_id, printer.id
    from users employee
    inner join printers printer
      on printer.office_id = employee.primary_office_id
      and printer.department_id = employee.department_id
      and printer.status = 'Active'
    inner join printer_monitoring_assignments assignment
      on assignment.printer_id = printer.id
    inner join monitoring_agents agent
      on agent.id = assignment.agent_id
      and agent.office_id = employee.primary_office_id
    where employee.role = 'employee'
    on conflict (user_id, printer_id) do nothing
  `);
  await client.query("commit");
  console.log(`Printer permissions ready; backfilled ${backfill.rowCount ?? 0} assignment(s).`);
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
