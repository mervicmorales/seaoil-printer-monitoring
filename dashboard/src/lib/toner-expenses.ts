export type TonerExpenseRecord = {
  date: string;
  departmentId: number | null;
  departmentName: string | null;
  locationId: number | null;
  locationName: string | null;
  tonerTypeId: number;
  tonerTypeName: string;
  quantity: number;
  unitCostCents: number;
};

export type ExpenseBreakdown = {
  key: string;
  name: string;
  requestLines: number;
  units: number;
  expenseCents: number;
};

export type DepartmentExpenseBreakdown = ExpenseBreakdown & {
  topToner: string;
};

export type TonerExpenseSummary = {
  totalExpenseCents: number;
  totalUnits: number;
  requestLines: number;
  pricedRequestLines: number;
  departments: DepartmentExpenseBreakdown[];
  locations: ExpenseBreakdown[];
  tonerTypes: ExpenseBreakdown[];
  months: ExpenseBreakdown[];
  unpricedTonerTypes: string[];
};

type MutableBreakdown = ExpenseBreakdown & {
  tonerUnits?: Map<string, number>;
};

export function amountToCents(value: string | number | null | undefined) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * 100);
}

export function summarizeTonerExpenses(records: readonly TonerExpenseRecord[]): TonerExpenseSummary {
  const departments = new Map<string, MutableBreakdown>();
  const locations = new Map<string, MutableBreakdown>();
  const tonerTypes = new Map<string, MutableBreakdown>();
  const months = new Map<string, MutableBreakdown>();
  const unpricedTonerTypes = new Set<string>();
  let totalExpenseCents = 0;
  let totalUnits = 0;
  let pricedRequestLines = 0;

  for (const record of records) {
    const quantity = Math.max(0, Math.trunc(record.quantity));
    const expenseCents = quantity * Math.max(0, Math.trunc(record.unitCostCents));
    const departmentKey = record.departmentId === null ? "unassigned" : String(record.departmentId);
    const departmentName = record.departmentName?.trim() || "Unassigned department";
    const locationKey = record.locationId === null ? "unassigned" : String(record.locationId);
    const locationName = record.locationName?.trim() || "Unassigned location";
    const tonerKey = String(record.tonerTypeId);
    const monthKey = record.date.slice(0, 7);

    totalExpenseCents += expenseCents;
    totalUnits += quantity;
    if (record.unitCostCents > 0) pricedRequestLines += 1;
    else unpricedTonerTypes.add(record.tonerTypeName);

    addToBreakdown(departments, departmentKey, departmentName, quantity, expenseCents, record.tonerTypeName);
    addToBreakdown(locations, locationKey, locationName, quantity, expenseCents);
    addToBreakdown(tonerTypes, tonerKey, record.tonerTypeName, quantity, expenseCents);
    addToBreakdown(months, monthKey, monthKey, quantity, expenseCents);
  }

  return {
    totalExpenseCents,
    totalUnits,
    requestLines: records.length,
    pricedRequestLines,
    departments: [...departments.values()]
      .map((row) => ({
        key: row.key,
        name: row.name,
        requestLines: row.requestLines,
        units: row.units,
        expenseCents: row.expenseCents,
        topToner: topMapEntry(row.tonerUnits),
      }))
      .sort(sortBreakdown),
    locations: [...locations.values()]
      .map(({ tonerUnits: _tonerUnits, ...row }) => row)
      .sort(sortBreakdown),
    tonerTypes: [...tonerTypes.values()]
      .map(({ tonerUnits: _tonerUnits, ...row }) => row)
      .sort(sortBreakdown),
    months: [...months.values()]
      .map(({ tonerUnits: _tonerUnits, ...row }) => row)
      .sort((a, b) => a.key.localeCompare(b.key)),
    unpricedTonerTypes: [...unpricedTonerTypes].sort((a, b) => a.localeCompare(b)),
  };
}

function addToBreakdown(
  map: Map<string, MutableBreakdown>,
  key: string,
  name: string,
  quantity: number,
  expenseCents: number,
  tonerName?: string,
) {
  const row = map.get(key) ?? {
    key,
    name,
    requestLines: 0,
    units: 0,
    expenseCents: 0,
    tonerUnits: tonerName ? new Map<string, number>() : undefined,
  };
  row.requestLines += 1;
  row.units += quantity;
  row.expenseCents += expenseCents;
  if (tonerName && row.tonerUnits) {
    row.tonerUnits.set(tonerName, (row.tonerUnits.get(tonerName) ?? 0) + quantity);
  }
  map.set(key, row);
}

function topMapEntry(values: Map<string, number> | undefined) {
  if (!values?.size) return "—";
  return [...values.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

function sortBreakdown(a: ExpenseBreakdown, b: ExpenseBreakdown) {
  return b.expenseCents - a.expenseCents || b.units - a.units || a.name.localeCompare(b.name);
}
