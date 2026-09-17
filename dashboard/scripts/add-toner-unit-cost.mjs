import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();

try {
  await client.query("begin");
  await client.query(`
    alter table toner_types
      add column if not exists unit_cost numeric(12, 2) not null default 0.00
  `);
  await client.query(`
    update toner_types
    set unit_cost = 0.00
    where unit_cost is null
  `);
  await client.query(`
    alter table toner_types
      alter column unit_cost set default 0.00,
      alter column unit_cost set not null
  `);
  await client.query("commit");
  console.log("Toner unit cost column is ready.");
} catch (error) {
  await client.query("rollback");
  throw error;
} finally {
  client.release();
  await pool.end();
}
