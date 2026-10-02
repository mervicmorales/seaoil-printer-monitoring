import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { parseOrganizationWorkbook } from "./organization-import.ts";

async function workbookBuffer(headers: string[], rows: Array<Array<string>>) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Collated data");
  sheet.addRow(headers);
  rows.forEach((row) => sheet.addRow(row));
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

test("organization import trims values, skips empty rows, and reports duplicates with source rows", async () => {
  const buffer = await workbookBuffer(
    ["Department", "Subunit", "Office", "Cost Center"],
    [
      [" ACCT ", " ACCT - CORP ", " Taipan Office ", " ACCT_CORP "],
      ["acct", "acct - corp", "taipan office", "acct_corp"],
      ["", "", "", ""],
      ["HR", "", "Bacolod Office", "HR_BCD"],
    ],
  );

  const parsed = await parseOrganizationWorkbook(buffer);
  assert.equal(parsed.totalRows, 3);
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.duplicateRows, 1);
  assert.equal(parsed.invalidRows, 1);
  assert.deepEqual(parsed.rows[0], {
    rowNumber: 2,
    department: "ACCT",
    subunit: "ACCT - CORP",
    office: "Taipan Office",
    costCenter: "ACCT_CORP",
  });
  assert.deepEqual(parsed.issues.map((issue) => issue.rowNumber), [3, 5]);
});

test("organization import rejects a workbook with missing required columns", async () => {
  const buffer = await workbookBuffer(
    ["Department", "Subunit", "Office"],
    [["ACCT", "ACCT - CORP", "Taipan Office"]],
  );
  await assert.rejects(() => parseOrganizationWorkbook(buffer), /Missing required column: Cost Center/);
});
