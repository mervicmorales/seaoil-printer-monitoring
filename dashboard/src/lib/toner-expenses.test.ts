import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { amountToCents, summarizeTonerExpenses } from "./toner-expenses.ts";

test("converts configured decimal costs into integer cents", () => {
  assert.equal(amountToCents("1250.75"), 125075);
  assert.equal(amountToCents(10.005), 1001);
  assert.equal(amountToCents(null), 0);
  assert.equal(amountToCents(-1), 0);
});

test("summarizes toner expenses by department, toner type, and month", () => {
  const summary = summarizeTonerExpenses([
    {
      date: "2026-01-05",
      departmentId: 1,
      departmentName: "Finance",
      locationId: 1,
      locationName: "Head Office",
      tonerTypeId: 10,
      tonerTypeName: "CF283X",
      quantity: 2,
      unitCostCents: 15000,
    },
    {
      date: "2026-01-10",
      departmentId: 1,
      departmentName: "Finance",
      locationId: 1,
      locationName: "Head Office",
      tonerTypeId: 11,
      tonerTypeName: "CRG725",
      quantity: 1,
      unitCostCents: 10000,
    },
    {
      date: "2026-02-01",
      departmentId: null,
      departmentName: null,
      locationId: null,
      locationName: null,
      tonerTypeId: 10,
      tonerTypeName: "CF283X",
      quantity: 3,
      unitCostCents: 15000,
    },
  ]);

  assert.equal(summary.totalExpenseCents, 85000);
  assert.equal(summary.totalUnits, 6);
  assert.equal(summary.requestLines, 3);
  assert.deepEqual(summary.departments.map((row) => [row.name, row.expenseCents, row.topToner]), [
    ["Finance", 40000, "CF283X"],
    ["Unassigned department", 45000, "CF283X"],
  ].sort((a, b) => Number(b[1]) - Number(a[1])));
  assert.deepEqual(summary.months.map((row) => [row.key, row.expenseCents]), [
    ["2026-01", 40000],
    ["2026-02", 45000],
  ]);
  assert.deepEqual(summary.locations.map((row) => [row.name, row.expenseCents]), [
    ["Unassigned office", 45000],
    ["Head Office", 40000],
  ]);
});

test("reports toner types that do not have a configured unit cost", () => {
  const summary = summarizeTonerExpenses([
    {
      date: "2026-03-01",
      departmentId: 2,
      departmentName: "Operations",
      locationId: 2,
      locationName: "Cebu Office",
      tonerTypeId: 20,
      tonerTypeName: "TN263 B",
      quantity: 4,
      unitCostCents: 0,
    },
  ]);

  assert.equal(summary.totalExpenseCents, 0);
  assert.equal(summary.pricedRequestLines, 0);
  assert.deepEqual(summary.unpricedTonerTypes, ["TN263 B"]);
});
