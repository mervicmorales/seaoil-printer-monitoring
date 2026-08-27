import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  const result = await client.query(`
    with latest_historical_agent as (
      select distinct on (reading.printer_id)
        reading.printer_id,
        reading.agent_id
      from printer_monitoring_readings reading
      inner join monitoring_agents agent on agent.id = reading.agent_id
      where agent.token_hash is not null
        and agent.token_revoked_at is null
      order by reading.printer_id, reading.checked_at desc, reading.id desc
    )
    insert into printer_monitoring_assignments (printer_id, agent_id)
    select printer_id, agent_id
    from latest_historical_agent
    on conflict (printer_id) do nothing
    returning printer_id, agent_id
  `);
  await client.query("commit");
  console.log(
    `Created ${result.rowCount ?? 0} assignment(s) from existing monitoring history.`,
  );
  console.log("Printers without monitoring history remain disabled.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
