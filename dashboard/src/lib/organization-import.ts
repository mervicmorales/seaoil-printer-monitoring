import ExcelJS from "exceljs";

export const ORGANIZATION_IMPORT_COLUMNS = ["Department", "Subunit", "Office", "Cost Center"] as const;
export const ORGANIZATION_IMPORT_MAX_VALUE_LENGTH = 255;

export type OrganizationStagedRow = {
  rowNumber: number;
  department: string;
  subunit: string;
  office: string;
  costCenter: string;
};

export type OrganizationImportIssue = { rowNumber: number; message: string };

export type ParsedOrganizationWorkbook = {
  rows: OrganizationStagedRow[];
  totalRows: number;
  duplicateRows: number;
  invalidRows: number;
  issues: OrganizationImportIssue[];
};

export async function parseOrganizationWorkbook(data: Buffer): Promise<ParsedOrganizationWorkbook> {
  const workbook = new ExcelJS.Workbook();
  // ExcelJS still declares the pre-generic Node Buffer type; the runtime value is a standard Buffer.
  await workbook.xlsx.load(data as never);
  const sheet = workbook.getWorksheet("Collated data");
  if (!sheet) throw new Error('Worksheet "Collated data" was not found.');

  const columns = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, columnNumber) => {
    columns.set(cellText(cell.value), columnNumber);
  });
  const missingColumns = ORGANIZATION_IMPORT_COLUMNS.filter((column) => !columns.has(column));
  if (missingColumns.length) {
    throw new Error(`Missing required column${missingColumns.length === 1 ? "" : "s"}: ${missingColumns.join(", ")}.`);
  }

  const rows: OrganizationStagedRow[] = [];
  const issues: OrganizationImportIssue[] = [];
  const seen = new Set<string>();
  let duplicateRows = 0;
  let totalRows = 0;

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const values = Object.fromEntries(ORGANIZATION_IMPORT_COLUMNS.map((column) => [
      column,
      cellText(row.getCell(columns.get(column)!).value),
    ])) as Record<(typeof ORGANIZATION_IMPORT_COLUMNS)[number], string>;
    if (ORGANIZATION_IMPORT_COLUMNS.every((column) => !values[column])) continue;
    totalRows += 1;

    const missing = ORGANIZATION_IMPORT_COLUMNS.filter((column) => !values[column]);
    const tooLong = ORGANIZATION_IMPORT_COLUMNS.filter((column) => values[column].length > ORGANIZATION_IMPORT_MAX_VALUE_LENGTH);
    if (missing.length || tooLong.length) {
      const parts = [
        missing.length ? `Missing ${missing.join(", ")}.` : "",
        tooLong.length ? `${tooLong.join(", ")} exceeds ${ORGANIZATION_IMPORT_MAX_VALUE_LENGTH} characters.` : "",
      ].filter(Boolean);
      issues.push({ rowNumber, message: parts.join(" ") });
      continue;
    }

    const staged: OrganizationStagedRow = {
      rowNumber,
      department: values.Department,
      subunit: values.Subunit,
      office: values.Office,
      costCenter: values["Cost Center"],
    };
    const rowKey = [staged.department, staged.subunit, staged.office, staged.costCenter]
      .map(organizationValueKey)
      .join("\u001f");
    if (seen.has(rowKey)) {
      duplicateRows += 1;
      issues.push({ rowNumber, message: "Duplicate organizational mapping." });
      continue;
    }
    seen.add(rowKey);
    rows.push(staged);
  }

  return {
    rows,
    totalRows,
    duplicateRows,
    invalidRows: issues.length - duplicateRows,
    issues,
  };
}

export function organizationValueKey(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function uniqueOrganizationValues(values: string[]) {
  const map = new Map<string, string>();
  for (const value of values) {
    const normalized = organizationValueKey(value);
    if (!map.has(normalized)) map.set(normalized, value);
  }
  return map;
}

function cellText(value: ExcelJS.CellValue) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if ("result" in value) return String(value.result ?? "").trim();
  }
  return String(value).trim();
}
