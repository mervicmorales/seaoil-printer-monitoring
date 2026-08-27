// One-off idempotent seed script for initial SEAOIL Printer Monitoring data.
// Run with: node scripts/seed.mjs
import pg from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MODULES = ["dashboard", "printers", "toner", "contract", "repair", "system"];

async function upsertUser(fullName, email, username, password, role) {
  const existing = await pool.query("select id from users where username = $1", [username]);
  let userId;
  if (existing.rows.length) {
    userId = existing.rows[0].id;
  } else {
    const hash = await bcrypt.hash(password, 10);
    const res = await pool.query(
      `insert into users (full_name, email, username, password_hash, role) values ($1,$2,$3,$4,$5) returning id`,
      [fullName, email, username, hash, role],
    );
    userId = res.rows[0].id;
    console.log(`Created ${role} user '${username}' / password '${password}'`);
  }
  for (const mod of MODULES) {
    const full = role === "admin" ? true : mod === "toner";
    await pool.query(
      `insert into user_module_access (user_id, module, full_access) values ($1,$2,$3)
       on conflict (user_id, module) do nothing`,
      [userId, mod, full],
    );
  }
}

async function upsertLookup(table, name) {
  await pool.query(`insert into ${table} (name) values ($1) on conflict (name) do nothing`, [name]);
}

async function main() {
  await upsertUser("System Administrator", "admin@seaoil.com.ph", "admin", "Admin@12345", "admin");
  await upsertUser("Sample Staff", "user@seaoil.com.ph", "user", "User@12345", "user");

  for (const name of ["Head Office", "Pasig Depot", "Cebu Depot", "Davao Station"]) {
    await upsertLookup("locations", name);
  }
  for (const name of ["IT Services", "Finance", "Operations", "Human Resources"]) {
    await upsertLookup("departments", name);
  }
  for (const name of ["Patrick", "Mervic", "Lowye"]) {
    await upsertLookup("its_names", name);
  }
  for (const name of ["CF283x", "LX-310", "TN263 B", "TN263 C", "TN263 Y", "TN263 M", "CRG725"]) {
    await upsertLookup("toner_types", name);
  }

  const types = await pool.query("select id from toner_types");
  for (const row of types.rows) {
    await pool.query(
      `insert into toner_inventory (toner_type_id, stock, low_stock_threshold) values ($1,$2,$3)
       on conflict (toner_type_id) do nothing`,
      [row.id, 10, 5],
    );
  }

  const vendorCount = await pool.query("select count(*)::int as c from vendors");
  if (vendorCount.rows[0].c === 0) {
    await pool.query(
      `insert into vendors (name, email, mobile, account_manager) values
       ('ABC Office Solutions', 'sales@abcoffice.com', '09171234567', 'Juan Dela Cruz'),
       ('PrintTech Philippines', 'support@printtech.ph', '09189876543', 'Maria Santos')`,
    );
  }

  const settingsCount = await pool.query("select count(*)::int as c from system_settings");
  if (settingsCount.rows[0].c === 0) {
    await pool.query(
      `insert into system_settings (notification_email, default_low_stock_threshold, email_reminder_enabled, system_notification_enabled)
       values ('itservicedesk@seaoil.com.ph', 5, true, true)`,
    );
  }

  console.log("Seed complete.");
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
