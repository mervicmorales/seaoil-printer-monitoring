import type { TonerExpenseSummary } from "@/lib/toner-expenses";

export const TONER_EXPENSE_EXPORT_FORMATS = ["xlsx", "csv"] as const;
export type TonerExpenseExportFormat = (typeof TONER_EXPENSE_EXPORT_FORMATS)[number];
export type TonerExpenseLookupFilter = number | "unassigned" | null;

export type TonerExpenseExportFilters = {
  allTime: boolean;
  dateFrom: string;
  dateTo: string;
  department: TonerExpenseLookupFilter;
  subunit: TonerExpenseLookupFilter;
  costCenter: TonerExpenseLookupFilter;
  location: TonerExpenseLookupFilter;
  tonerType: TonerExpenseLookupFilter;
  itsName: TonerExpenseLookupFilter;
};

export type TonerExpenseExportFilterLabels = {
  period: string;
  department: string;
  subunit: string;
  costCenter: string;
  location: string;
  tonerType: string;
  itsName: string;
};

export type TonerExpenseExportRow = {
  transactionId: number;
  groupId: string;
  date: string;
  ticketReference: string;
  department: string;
  subunit: string;
  costCenter: string;
  location: string;
  tonerType: string;
  quantity: number;
  unitCostCents: number;
  totalExpenseCents: number;
  itsName: string;
  remarks: string;
  recordedAt: Date;
};

export type TonerExpenseExportReport = {
  filters: TonerExpenseExportFilters;
  filterLabels: TonerExpenseExportFilterLabels;
  rows: TonerExpenseExportRow[];
  summary: TonerExpenseSummary;
  exceededLimit: boolean;
};

export type TonerExpenseExportPreview = {
  recordCount: number;
  totalUnits: number;
  totalExpenseCents: number;
  priceCoverage: number;
};

export const MAX_TONER_EXPENSE_EXPORT_ROWS = 50_000;

export function parseTonerExpenseExportFilters(
  params: URLSearchParams,
  today = manilaDate(),
): { filters: TonerExpenseExportFilters; errors: string[] } {
  const errors: string[] = [];
  const allTime = params.get("allTime") === "1";
  const defaultStart = `${today.slice(0, 4)}-01-01`;
  const dateFrom = allTime
    ? ""
    : parseDate(params.get("dateFrom"), "Date from", defaultStart, errors);
  const dateTo = allTime
    ? ""
    : parseDate(params.get("dateTo"), "Date to", today, errors);

  const filters = {
    allTime,
    dateFrom,
    dateTo,
    department: parseLookup(params.get("department"), "Department", errors),
    subunit: parseLookup(params.get("subunit"), "Subunit", errors),
    costCenter: parseLookup(params.get("costCenter"), "Cost center", errors),
    location: parseLookup(params.get("location"), "Office", errors),
    tonerType: parseLookup(params.get("tonerType"), "Toner type", errors),
    itsName: parseLookup(params.get("itsName"), "ITS name", errors),
  } satisfies TonerExpenseExportFilters;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    errors.push("Date from must be on or before date to.");
  }

  return { filters, errors };
}

export function tonerExpenseExportPreview(
  summary: TonerExpenseSummary,
): TonerExpenseExportPreview {
  return {
    recordCount: summary.requestLines,
    totalUnits: summary.totalUnits,
    totalExpenseCents: summary.totalExpenseCents,
    priceCoverage: summary.requestLines
      ? Math.round((summary.pricedRequestLines / summary.requestLines) * 100)
      : 0,
  };
}

export function buildTonerExpenseCsv(rows: readonly TonerExpenseExportRow[]) {
  const headers = [
    "Transaction ID",
    "Group ID",
    "Date",
    "Ticket Reference",
    "Department",
    "Subunit",
    "Cost Center",
    "Office",
    "Toner Type",
    "Quantity",
    "Unit Cost (PHP)",
    "Total Expense (PHP)",
    "ITS Name",
    "Remarks",
    "Recorded At",
  ];
  const body = rows.map((row) => [
    row.transactionId,
    row.groupId,
    row.date,
    row.ticketReference,
    row.department,
    row.subunit,
    row.costCenter,
    row.location,
    row.tonerType,
    row.quantity,
    (row.unitCostCents / 100).toFixed(2),
    (row.totalExpenseCents / 100).toFixed(2),
    row.itsName,
    row.remarks,
    row.recordedAt.toISOString(),
  ]);

  return `\uFEFF${[headers, ...body].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function tonerExpenseExportFileName(
  format: TonerExpenseExportFormat,
  now = new Date(),
) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Manila",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "00";
  return `toner-expenses-${part("year")}${part("month")}${part("day")}-${part("hour")}${part("minute")}.${format}`;
}

function parseLookup(
  value: string | null,
  label: string,
  errors: string[],
): TonerExpenseLookupFilter {
  if (!value) return null;
  if (value === "unassigned") return value;
  const parsed = Number.parseInt(value, 10);
  if (Number.isSafeInteger(parsed) && parsed > 0 && String(parsed) === value) return parsed;
  errors.push(`${label} filter is invalid.`);
  return null;
}

function parseDate(
  value: string | null,
  label: string,
  fallback: string,
  errors: string[],
) {
  if (!value) return fallback;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && isCalendarDate(value)) return value;
  errors.push(`${label} is invalid.`);
  return fallback;
}

function isCalendarDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function csvCell(value: string | number) {
  const text = String(value);
  const protectedText = /^[=+\-@]/.test(text.trimStart()) ? `'${text}` : text;
  return `"${protectedText.replaceAll('"', '""')}"`;
}

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date());
}
