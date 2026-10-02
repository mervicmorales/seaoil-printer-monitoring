import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TS extension.
import { buildTonerExpenseCsv, parseTonerExpenseExportFilters, tonerExpenseExportFileName, tonerExpenseExportPreview } from "./toner-expense-export.ts";

test("export filters default to the current Manila year", () => {
  const result = parseTonerExpenseExportFilters(new URLSearchParams(), "2026-09-17");
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.filters, {
    allTime: false,
    dateFrom: "2026-01-01",
    dateTo: "2026-09-17",
    department: null,
    subunit: null,
    costCenter: null,
    location: null,
    tonerType: null,
    itsName: null,
  });
});

test("export filters support all-time and lookup values", () => {
  const params = new URLSearchParams({
    allTime: "1",
    department: "12",
    location: "unassigned",
    tonerType: "4",
    itsName: "9",
  });
  const result = parseTonerExpenseExportFilters(params, "2026-09-17");
  assert.deepEqual(result.errors, []);
  assert.equal(result.filters.allTime, true);
  assert.equal(result.filters.dateFrom, "");
  assert.equal(result.filters.dateTo, "");
  assert.equal(result.filters.department, 12);
  assert.equal(result.filters.location, "unassigned");
});

test("export filters reject invalid dates, order, and identifiers", () => {
  const invalidDate = parseTonerExpenseExportFilters(
    new URLSearchParams({ dateFrom: "2026-02-30", department: "12oops" }),
    "2026-09-17",
  );
  assert.equal(invalidDate.errors.length, 2);

  const invalidOrder = parseTonerExpenseExportFilters(
    new URLSearchParams({ dateFrom: "2026-09-18", dateTo: "2026-09-17" }),
    "2026-09-17",
  );
  assert.deepEqual(invalidOrder.errors, ["Date from must be on or before date to."]);
});

test("CSV output quotes fields and protects spreadsheet formulas", () => {
  const csv = buildTonerExpenseCsv([{
    transactionId: 10,
    groupId: "group-1",
    date: "2026-09-17",
    ticketReference: "=HYPERLINK(\"bad\")",
    department: "Finance, Treasury",
    subunit: "Finance - AP",
    costCenter: "FIN_AP",
    location: "Head Office",
    tonerType: "Black \"XL\"",
    quantity: 2,
    unitCostCents: 125050,
    totalExpenseCents: 250100,
    itsName: "Support",
    remarks: "Line one\nLine two",
    recordedAt: new Date("2026-09-17T01:02:03.000Z"),
  }]);

  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
  assert.match(csv, /"Finance, Treasury"/);
  assert.match(csv, /"Black ""XL"""/);
  assert.match(csv, /"Line one\nLine two"/);
});

test("preview and filenames are stable", () => {
  const preview = tonerExpenseExportPreview({
    totalExpenseCents: 15_000,
    totalUnits: 5,
    requestLines: 4,
    pricedRequestLines: 3,
    departments: [],
    locations: [],
    tonerTypes: [],
    months: [],
    unpricedTonerTypes: [],
  });
  assert.deepEqual(preview, {
    recordCount: 4,
    totalUnits: 5,
    totalExpenseCents: 15_000,
    priceCoverage: 75,
  });
  assert.equal(
    tonerExpenseExportFileName("xlsx", new Date("2026-09-17T08:34:00.000Z")),
    "toner-expenses-20260917-1634.xlsx",
  );
});
