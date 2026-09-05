import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { Pool } from "pg";

// Run with node --env-file=.env.local --conditions=react-server --import tsx --test src/app/register/actions.test.ts
test("registration reports duplicate identities without creating another request", async (t) => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for PostgreSQL integration tests");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const globalForDb = globalThis as typeof globalThis & { __arenaNextJsPostgresqlPool?: Pool };
  globalForDb.__arenaNextJsPostgresqlPool = pool;
  // Match Next.js's server-only alias when running outside its bundler.
  const hooks = registerHooks({
    resolve(specifier, context, nextResolve) {
      return nextResolve(specifier === "server-only" ? "next/dist/compiled/server-only/empty.js" : specifier, context);
    },
  });
  try {
    await pool.query("BEGIN");
    // Temporary tables shadow the real tables on this connection. Roll back every fixture.
    for (const table of ["users", "user_registration_requests", "email_verification_tokens", "system_settings", "locations", "departments"]) {
      await pool.query(`CREATE TEMP TABLE ${table} ON COMMIT DROP AS SELECT * FROM public.${table} WITH NO DATA`);
    }
    await pool.query("INSERT INTO system_settings (registration_enabled) VALUES (true)");
    await pool.query("INSERT INTO locations (id) VALUES (1)");
    await pool.query("INSERT INTO departments (id) VALUES (1)");
    const { registerAction } = await import("./actions");

    const cases = [
      { name: "existing employee ID", table: "users", email: "different@seaoil.com.ph", employeeId: "SPI00001", username: "different", fields: ["employeeId"] },
      { name: "existing email, ignoring case", table: "users", email: "TEST@SEAOIL.COM.PH", employeeId: "SPI00002", username: "other", fields: ["email"] },
      { name: "both identifiers, ignoring case", table: "users", email: "TEST@SEAOIL.COM.PH", employeeId: "spi00001", username: "TEST", fields: ["employeeId", "email"] },
      { name: "identifiers belonging to separate accounts", table: "users", email: "different@seaoil.com.ph", employeeId: "SPI00001", username: "different", secondAccount: true, fields: ["employeeId", "email"] },
      { name: "derived username collision", table: "users", email: "test@example.com", employeeId: "SPI00002", username: "test", fields: ["email"] },
      ...["pending_email", "pending_admin", "approved"].map((status) => ({ name: `${status} registration`, table: "user_registration_requests", email: "test@seaoil.com.ph", employeeId: "SPI00001", username: "test", status, fields: ["employeeId", "email"] })),
    ];
    for (const fixture of cases) {
      await t.test(fixture.name, async () => {
        await pool.query("TRUNCATE pg_temp.users, pg_temp.user_registration_requests, pg_temp.email_verification_tokens");
        if (fixture.table === "users") {
          await pool.query("INSERT INTO users (id, email, employee_id, username) VALUES (1, $1, $2, $3)", [fixture.email, fixture.employeeId, fixture.username]);
          if ("secondAccount" in fixture) {
            await pool.query("INSERT INTO users (id, email, employee_id, username) VALUES (2, 'test@seaoil.com.ph', 'SPI00002', 'test')");
          }
        } else {
          await pool.query("INSERT INTO user_registration_requests (id, email, employee_id, username, status, created_at, expires_at) VALUES (1, $1, $2, $3, $4, now(), now() + interval '1 day')", [fixture.email, fixture.employeeId, fixture.username, "status" in fixture ? fixture.status : "pending_email"]);
        }
        const form = new FormData();
        for (const [key, value] of Object.entries({ fullName: "Test Employee", employeeId: " spi00001 ", email: " Test@seaoil.com.ph ", password: "Test-only-password1!", confirmPassword: "Test-only-password1!", primaryLocationId: "1", departmentId: "1" })) form.set(key, value);
        const result = await registerAction({}, form);
        assert.match(result.error ?? "", /already exists/);
        assert.equal(result.success, undefined);
        assert.deepEqual(Object.keys(result.fieldErrors ?? {}).sort(), fixture.fields.sort());
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM user_registration_requests")).rows[0].count, fixture.table === "users" ? 0 : 1);
        assert.equal((await pool.query("SELECT count(*)::int AS count FROM email_verification_tokens")).rows[0].count, 0);
      });
    }
  } finally {
    await pool.query("ROLLBACK");
    delete globalForDb.__arenaNextJsPostgresqlPool;
    hooks.deregister();
    await pool.end();
  }
});
