export const OVERVIEW_PERIODS = ["7d", "30d", "90d", "12m", "ytd", "all"] as const;
export const OVERVIEW_EXPENSE_BREAKDOWNS = ["toner", "location", "department"] as const;
export const OVERVIEW_EXPENSE_GRAINS = ["monthly", "quarterly", "yearly"] as const;
export const OVERVIEW_EXPENSE_SORTS = ["desc", "asc"] as const;

export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];
export type OverviewExpenseBreakdown = (typeof OVERVIEW_EXPENSE_BREAKDOWNS)[number];
export type OverviewExpenseGrain = (typeof OVERVIEW_EXPENSE_GRAINS)[number];
export type OverviewExpenseSort = (typeof OVERVIEW_EXPENSE_SORTS)[number];

export type OverviewScope = {
  locationId: number | null;
  departmentId: number | null;
  period: OverviewPeriod;
  expenseBreakdown: OverviewExpenseBreakdown;
  expenseGrain: OverviewExpenseGrain;
  expenseSort: OverviewExpenseSort;
};

export function parseOverviewScope(values: Record<string, string | string[] | undefined>): OverviewScope {
  return {
    locationId: positiveInteger(first(values.location)),
    departmentId: positiveInteger(first(values.department)),
    period: member(first(values.period), OVERVIEW_PERIODS, "30d"),
    expenseBreakdown: member(first(values.expenseBreakdown), OVERVIEW_EXPENSE_BREAKDOWNS, "toner"),
    expenseGrain: member(first(values.expenseGrain), OVERVIEW_EXPENSE_GRAINS, "monthly"),
    expenseSort: member(first(values.expenseSort), OVERVIEW_EXPENSE_SORTS, "desc"),
  };
}

export function resolveOverviewPeriod(period: OverviewPeriod, today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const current = new Date(Date.UTC(year, month - 1, day));
  if (period === "all") return { fromDate: null, toDate: today, label: "All recorded activity" };
  if (period === "ytd") return { fromDate: `${year}-01-01`, toDate: today, label: `${year} year to date` };
  if (period === "12m") {
    const start = new Date(Date.UTC(year, month - 12, 1));
    return { fromDate: isoDate(start), toDate: today, label: "Last 12 months" };
  }
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const start = new Date(current);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return { fromDate: isoDate(start), toDate: today, label: `Last ${days} days` };
}

export function yearlyExpenseSeries(
  months: readonly { key: string; name: string; requestLines: number; units: number; expenseCents: number }[],
) {
  const years = new Map<string, { key: string; name: string; requestLines: number; units: number; expenseCents: number }>();
  for (const month of months) {
    const key = month.key.slice(0, 4);
    const current = years.get(key) ?? { key, name: key, requestLines: 0, units: 0, expenseCents: 0 };
    current.requestLines += month.requestLines;
    current.units += month.units;
    current.expenseCents += month.expenseCents;
    years.set(key, current);
  }
  return [...years.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function quarterlyExpenseSeries(
  months: readonly { key: string; name: string; requestLines: number; units: number; expenseCents: number }[],
) {
  const quarters = new Map<string, { key: string; name: string; requestLines: number; units: number; expenseCents: number }>();
  for (const month of months) {
    const [year, monthNumber] = month.key.split("-").map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) continue;
    const quarter = Math.ceil(monthNumber / 3);
    const key = `${year}-Q${quarter}`;
    const current = quarters.get(key) ?? { key, name: `Q${quarter} ${year}`, requestLines: 0, units: 0, expenseCents: 0 };
    current.requestLines += month.requestLines;
    current.units += month.units;
    current.expenseCents += month.expenseCents;
    quarters.set(key, current);
  }
  return [...quarters.values()].sort((left, right) => left.key.localeCompare(right.key));
}

export function sortExpenseRows<T extends { expenseCents: number; name: string }>(
  rows: readonly T[],
  direction: OverviewExpenseSort,
) {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) =>
    (left.expenseCents - right.expenseCents) * multiplier || left.name.localeCompare(right.name),
  );
}

function member<Value extends string>(
  value: string | undefined,
  allowed: readonly Value[],
  fallback: Value,
) {
  return allowed.includes(value as Value) ? value as Value : fallback;
}

function positiveInteger(value: string | undefined) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}
