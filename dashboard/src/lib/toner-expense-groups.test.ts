import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { groupTonerRequests, type TonerExpenseViewRecord } from "./toner-expense-groups.ts";

const base = {
  date: "2026-09-01",
  departmentId: 1,
  departmentName: "Operations",
  locationId: 10,
  locationName: "Head Office",
  costCenterId: 1000,
  costCenterCode: "OPS-HO",
  tonerTypeId: 100,
  tonerTypeName: "TN-100",
  itsNameId: null,
  unitCostCents: 2_500,
};

test("groups toner requests by department, cost center, and toner type", () => {
  const records: TonerExpenseViewRecord[] = [
    { ...base, id: 1, quantity: 2 },
    { ...base, id: 2, costCenterId: 1001, costCenterCode: "OPS-DEPOT", quantity: 1 },
    { ...base, id: 3, tonerTypeId: 101, tonerTypeName: "TN-200", quantity: 3 },
    { ...base, id: 4, departmentId: 2, departmentName: "Finance", quantity: 1 },
  ];

  const groups = groupTonerRequests(records);
  const operations = groups.find((group) => group.name === "Operations");

  assert.ok(operations);
  assert.equal(operations.requestLines, 3);
  assert.equal(operations.units, 6);
  assert.equal(operations.expenseCents, 15_000);
  assert.deepEqual(operations.costCenters.map((row) => [row.name, row.units]), [
    ["OPS-HO", 5],
    ["OPS-DEPOT", 1],
  ]);
  assert.deepEqual(operations.tonerTypes.map((row) => [row.name, row.units]), [
    ["TN-100", 3],
    ["TN-200", 3],
  ]);
});
