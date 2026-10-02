// One-off idempotent seed script for initial SEAOIL Printer Monitoring data.
// Run with: node scripts/seed.mjs
import pg from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function seedPassword(name, developmentDefault) {
  const value = process.env[name]?.trim();
  if (value && value.length >= 12) return value;
  if (process.env.NODE_ENV !== "production") return developmentDefault;
  throw new Error(`${name} is required in production and must contain at least 12 characters`);
}

function requiredSeedPassword(name) {
  const value = process.env[name]?.trim();
  if (value && value.length >= 12) return value;
  throw new Error(`${name} is required and must contain at least 12 characters`);
}

const MODULES = [
  "dashboard",
  "printers",
  "toner",
  "contract",
  "repair",
  "printops",
  "system",
  "manage_users",
  "registrations",
];

async function upsertUser(fullName, email, username, password, role, syncAccount = false) {
  const existing = await pool.query("select id from users where username = $1", [username]);
  let userId;
  if (existing.rows.length) {
    userId = existing.rows[0].id;
    if (syncAccount) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query(
        `update users
         set full_name = $1, email = $2, password_hash = $3, role = $4, account_status = 'active'
         where id = $5`,
        [fullName, email, hash, role, userId],
      );
      console.log(`Updated ${role} user '${username}'.`);
    }
  } else {
    const hash = await bcrypt.hash(password, 10);
    const res = await pool.query(
      `insert into users (full_name, email, username, password_hash, role) values ($1,$2,$3,$4,$5) returning id`,
      [fullName, email, username, hash, role],
    );
    userId = res.rows[0].id;
    console.log(`Created ${role} user '${username}'.`);
  }
  for (const mod of MODULES) {
    const full = role === "super_admin" || role === "admin" ? true : mod === "toner";
    if (syncAccount) {
      await pool.query(
        `insert into user_module_access (user_id, module, full_access) values ($1,$2,$3)
         on conflict (user_id, module) do update set full_access = excluded.full_access`,
        [userId, mod, full],
      );
    } else {
      await pool.query(
        `insert into user_module_access (user_id, module, full_access) values ($1,$2,$3)
         on conflict (user_id, module) do nothing`,
        [userId, mod, full],
      );
    }
  }
}

async function upsertLookup(table, name) {
  await pool.query(`insert into ${table} (name) values ($1) on conflict (name) do nothing`, [name]);
}

async function main() {
  const superAdminPassword = requiredSeedPassword("SEED_SUPER_ADMIN_PASSWORD");
  const adminPassword = seedPassword("SEED_ADMIN_PASSWORD", "Admin@12345");
  const supportPassword = seedPassword("SEED_SUPPORT_PASSWORD", "User@12345");
  await pool.query("delete from user_module_access where module = 'spot'");
  await upsertUser("Super Admin", "", "super_admin", superAdminPassword, "super_admin", true);
  await upsertUser("System Administrator", "admin@seaoil.com.ph", "admin", adminPassword, "admin");
  await upsertUser("Sample Support", "user@seaoil.com.ph", "user", supportPassword, "support");

  for (const name of ["Head Office", "Pasig Depot", "Cebu Depot", "Davao Station"]) {
    await upsertLookup("offices", name);
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
