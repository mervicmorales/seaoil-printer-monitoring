import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";

// Run with: node --env-file=.env.local --import tsx --test src/lib/organization-schema.integration.test.ts
test("organization schema supports idempotent mappings and transaction rollback", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for PostgreSQL integration tests");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  const client = await pool.connect();
  const suffix = randomUUID();
  const departmentName = `__ORG_TEST_DEPARTMENT_${suffix}`;
  const officeName = `__ORG_TEST_OFFICE_${suffix}`;
  const subunitName = `__ORG_TEST_SUBUNIT_${suffix}`;
  const costCenterCode = `__ORG_TEST_COST_${suffix}`;

  try {
    await client.query("BEGIN");
    const departmentId = (await client.query(
      "insert into departments(name) values($1) returning id",
      [departmentName],
    )).rows[0].id as number;
    const officeId = (await client.query(
      "insert into offices(name) values($1) returning id",
      [officeName],
    )).rows[0].id as number;
    const costCenterId = (await client.query(
      "insert into cost_centers(code) values($1) returning id",
      [costCenterCode],
    )).rows[0].id as number;
    const subunitId = (await client.query(
      "insert into subunits(department_id, name) values($1, $2) returning id",
      [departmentId, subunitName],
    )).rows[0].id as number;

    await client.query(
      "insert into organization_mappings(office_id, subunit_id, cost_center_id) values($1, $2, $3) on conflict do nothing",
      [officeId, subunitId, costCenterId],
    );
    await client.query(
      "insert into organization_mappings(office_id, subunit_id, cost_center_id) values($1, $2, $3) on conflict do nothing",
      [officeId, subunitId, costCenterId],
    );
    const duplicateCount = await client.query(
      "select count(*)::int as count from organization_mappings where office_id=$1 and subunit_id=$2 and cost_center_id=$3",
      [officeId, subunitId, costCenterId],
    );
    assert.equal(duplicateCount.rows[0].count, 1);

    await client.query("SAVEPOINT invalid_reference");
    await assert.rejects(
      client.query("insert into subunits(department_id, name) values($1, $2)", [2_147_483_647, `${subunitName}_INVALID`]),
      /foreign key/i,
    );
    await client.query("ROLLBACK TO SAVEPOINT invalid_reference");
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    const persisted = await client.query(
      "select count(*)::int as count from departments where name=$1",
      [departmentName],
    );
    assert.equal(persisted.rows[0].count, 0);
    client.release();
    await pool.end();
  }
});
