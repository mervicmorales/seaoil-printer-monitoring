import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    alter table toner_transactions
      add column if not exists delivered_date date
  `);
  await pool.query(`
    update toner_transactions
    set delivered_date = date
    where delivered_date is null
      and lower(type) in ('delivery', 'delivered')
  `);
  console.log("Toner transaction delivered date column is ready.");
} finally {
  await pool.end();
}
