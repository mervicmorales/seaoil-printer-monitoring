import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("create sequence if not exists repair_ticket_sequence as bigint start with 1");
  const { rows } = await pool.query(`
    select coalesce(max(substring(ticket_number from '^PR([0-9]+)$')::bigint), 0) as maximum
    from repair_tickets
  `);
  const maximum = BigInt(rows[0]?.maximum ?? 0);
  const sequence = await pool.query("select last_value, is_called from repair_ticket_sequence");
  const lastValue = BigInt(sequence.rows[0].last_value);
  const nextSequenceValue = sequence.rows[0].is_called ? lastValue + 1n : lastValue;
  const nextValue = maximum + 1n > nextSequenceValue ? maximum + 1n : nextSequenceValue;
  await pool.query("select setval('repair_ticket_sequence', $1, false)", [nextValue.toString()]);
  console.log("Repair ticket sequence is ready.");
} finally {
  await pool.end();
}
