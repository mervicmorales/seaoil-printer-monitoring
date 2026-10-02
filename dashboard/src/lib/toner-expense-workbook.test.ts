import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
// @ts-expect-error Node's type-stripping test runner requires the explicit TS extension.
import { buildTonerExpenseWorkbook } from "./toner-expense-workbook.ts";

test("Excel export includes editable detail and management sheets", async () => {
  const generatedAt = new Date("2026-09-17T08:34:00.000Z");
  const buffer = await buildTonerExpenseWorkbook({
    filters: {
      allTime: false,
      dateFrom: "2026-01-01",
      dateTo: "2026-09-17",
      department: null,
      subunit: null,
      costCenter: null,
      location: null,
      tonerType: null,
      itsName: null,
    },
    filterLabels: {
      period: "01 Jan 2026 to 17 Sep 2026",
      department: "All departments",
      subunit: "All subunits",
      costCenter: "All cost centers",
      location: "All offices",
      tonerType: "All toner types",
      itsName: "All ITS names",
    },
    rows: [{
      transactionId: 42,
      groupId: "request-42",
      date: "2026-09-17",
      ticketReference: "INC-100",
      department: "Information Technology",
      subunit: "IT - Infrastructure",
      costCenter: "IT_INFRA",
      location: "Head Office",
      tonerType: "HP 151A Black",
      quantity: 2,
      unitCostCents: 350_000,
      totalExpenseCents: 700_000,
      itsName: "ITS Support",
      remarks: "Urgent",
      recordedAt: generatedAt,
    }],
    summary: {
      totalExpenseCents: 700_000,
      totalUnits: 2,
      requestLines: 1,
      pricedRequestLines: 1,
      departments: [{ key: "1", name: "Information Technology", requestLines: 1, units: 2, expenseCents: 700_000, topToner: "HP 151A Black" }],
      locations: [{ key: "1", name: "Head Office", requestLines: 1, units: 2, expenseCents: 700_000 }],
      tonerTypes: [{ key: "1", name: "HP 151A Black", requestLines: 1, units: 2, expenseCents: 700_000 }],
      months: [{ key: "2026-09", name: "2026-09", requestLines: 1, units: 2, expenseCents: 700_000 }],
      unpricedTonerTypes: [],
    },
    exceededLimit: false,
  }, {
    fullName: "Test Administrator",
    email: "admin@example.com",
    username: "admin",
  }, generatedAt);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    "Summary",
    "Expense Details",
    "Department Breakdown",
    "Office Breakdown",
    "Export Information",
  ]);
  const details = workbook.getWorksheet("Expense Details");
  assert.ok(details);
  assert.equal(details.getCell("A2").value, 42);
  assert.equal(details.getCell("E2").value, "Information Technology");
  assert.equal(details.getCell("L2").value, 7_000);
  assert.equal(details.autoFilter, "A1:O1");
});
