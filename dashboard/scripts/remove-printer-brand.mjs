import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import pg from "pg";

const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

try {
  await db.transaction(async (tx) => {
    await tx.execute(sql`alter table printers drop column if exists brand`);
    await tx.execute(sql`alter table replacement_history drop column if exists brand`);
    const [discoveryTable, printOpsTable] = await Promise.all([
      tx.execute(sql`select to_regclass('public.printer_discovery_scans') as name`),
      tx.execute(sql`select to_regclass('public.print_ops_commands') as name`),
    ]);

    if (discoveryTable.rows[0]?.name) {
      await tx.execute(sql`
        update printer_discovery_scans
        set results = coalesce(
          (
            select jsonb_agg(item - 'brand')
            from jsonb_array_elements(results) as item
          ),
          '[]'::jsonb
        )
        where jsonb_path_exists(results, '$[*].brand')
      `);
    }

    if (printOpsTable.rows[0]?.name) {
      await tx.execute(sql`
        update print_ops_commands
        set result = jsonb_set(
          result,
          '{printerTargets}',
          coalesce(
            (
              select jsonb_agg(item - 'brand')
              from jsonb_array_elements(result->'printerTargets') as item
            ),
            '[]'::jsonb
          )
        )
        where jsonb_typeof(result) = 'object'
          and jsonb_typeof(result->'printerTargets') = 'array'
          and jsonb_path_exists(result->'printerTargets', '$[*].brand')
      `);
    }
  });

  const remaining = await db.execute(sql`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('printers', 'replacement_history')
      and column_name = 'brand'
  `);
  if (remaining.rows.length > 0) {
    throw new Error("Brand columns are still present after migration");
  }

  console.log("Removed printer Brand columns and stored dashboard record fields.");
} finally {
  await pool.end();
}
