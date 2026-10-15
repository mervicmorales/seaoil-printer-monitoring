import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`
    alter table toner_transactions
      add column if not exists requestor_name text
  `);
  console.log("Toner transaction requestor name column is ready.");
} finally {
  await pool.end();
}
