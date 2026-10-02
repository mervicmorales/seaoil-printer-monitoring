import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TS extension.
import { parseOverviewScope, quarterlyExpenseSeries, resolveOverviewPeriod, sortExpenseRows, yearlyExpenseSeries } from "./overview-analytics.ts";

test("overview scope accepts supported values and rejects unsafe identifiers", () => {
  assert.deepEqual(parseOverviewScope({ location: "12", department: "7", period: "90d", expenseBreakdown: "location", expenseGrain: "yearly", expenseSort: "asc" }), {
    locationId: 12,
    departmentId: 7,
    period: "90d",
    expenseBreakdown: "location",
    expenseGrain: "yearly",
    expenseSort: "asc",
  });
  assert.deepEqual(parseOverviewScope({ location: "-1", department: "x", period: "invalid" }), {
    locationId: null,
    departmentId: null,
    period: "30d",
    expenseBreakdown: "toner",
    expenseGrain: "monthly",
    expenseSort: "desc",
  });
});

test("overview periods resolve to stable Manila calendar ranges", () => {
  assert.deepEqual(resolveOverviewPeriod("30d", "2026-09-19"), {
    fromDate: "2026-08-21",
    toDate: "2026-09-19",
    label: "Last 30 days",
  });
  assert.deepEqual(resolveOverviewPeriod("7d", "2026-09-19"), {
    fromDate: "2026-09-13",
    toDate: "2026-09-19",
    label: "Last 7 days",
  });
  assert.equal(resolveOverviewPeriod("ytd", "2026-09-19").fromDate, "2026-01-01");
  assert.equal(resolveOverviewPeriod("12m", "2026-09-19").fromDate, "2025-10-01");
  assert.equal(resolveOverviewPeriod("all", "2026-09-19").fromDate, null);
});

test("expense helpers aggregate years and support low-to-high ranking", () => {
  const years = yearlyExpenseSeries([
    { key: "2025-12", name: "2025-12", requestLines: 1, units: 2, expenseCents: 200 },
    { key: "2026-01", name: "2026-01", requestLines: 2, units: 3, expenseCents: 300 },
    { key: "2026-02", name: "2026-02", requestLines: 1, units: 1, expenseCents: 100 },
  ]);
  assert.deepEqual(years.map((row) => [row.key, row.expenseCents]), [["2025", 200], ["2026", 400]]);
  assert.deepEqual(sortExpenseRows([
    { name: "High", expenseCents: 500 },
    { name: "Low", expenseCents: 100 },
  ], "asc").map((row) => row.name), ["Low", "High"]);
});

test("expense helpers aggregate calendar quarters", () => {
  const quarters = quarterlyExpenseSeries([
    { key: "2026-01", name: "2026-01", requestLines: 1, units: 2, expenseCents: 200 },
    { key: "2026-03", name: "2026-03", requestLines: 2, units: 3, expenseCents: 300 },
    { key: "2026-04", name: "2026-04", requestLines: 1, units: 1, expenseCents: 100 },
  ]);
  assert.deepEqual(quarters.map((row) => [row.key, row.name, row.expenseCents]), [
    ["2026-Q1", "Q1 2026", 500],
    ["2026-Q2", "Q2 2026", 100],
  ]);
});
