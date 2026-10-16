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

test("groups toner requests by department, cost center, office, and toner type", () => {
  const records: TonerExpenseViewRecord[] = [
    { ...base, id: 1, quantity: 2 },
    { ...base, id: 2, costCenterId: 1001, costCenterCode: "OPS-DEPOT", quantity: 1 },
    { ...base, id: 3, tonerTypeId: 101, tonerTypeName: "TN-200", quantity: 3 },
    { ...base, id: 4, departmentId: 2, departmentName: "Finance", quantity: 1 },
    { ...base, id: 5, locationId: 11, locationName: "Branch Office", quantity: 4 },
  ];

  const groups = groupTonerRequests(records);
  const operations = groups.find((group) => group.name === "Operations");

  assert.ok(operations);
  assert.equal(operations.requestLines, 4);
  assert.equal(operations.units, 10);
  assert.equal(operations.expenseCents, 25_000);
  assert.deepEqual(operations.costCenters.map((row) => [row.name, row.units]), [
    ["OPS-HO", 9],
    ["OPS-DEPOT", 1],
  ]);
  assert.deepEqual(operations.costCenters.map((row) => [row.name, row.offices.map((office) => [office.name, office.units])]), [
    ["OPS-HO", [["Head Office", 5], ["Branch Office", 4]]],
    ["OPS-DEPOT", [["Head Office", 1]]],
  ]);
  assert.deepEqual(operations.tonerTypes.map((row) => [row.name, row.units]), [
    ["TN-100", 7],
    ["TN-200", 3],
  ]);
  assert.deepEqual(operations.costCenters[0]?.offices[0]?.tonerTypes.map((row) => [row.name, row.units]), [
    ["TN-200", 3],
    ["TN-100", 2],
  ]);
});
