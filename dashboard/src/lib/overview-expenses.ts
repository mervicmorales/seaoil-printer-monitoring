import "server-only";
import { and, eq, gte, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { departments, locations, tonerTransactions, tonerTypes } from "@/db/schema";
import { resolveOverviewPeriod, type OverviewPeriod } from "@/lib/overview-analytics";
import { amountToCents, summarizeTonerExpenses } from "@/lib/toner-expenses";

const CACHE_TTL_MS = 15_000;
const expenseCache = new Map<string, { expiresAt: number; value: ReturnType<typeof queryOverviewExpenses> }>();

export function manilaDate(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(value);
}

export function getOverviewExpenses(period: OverviewPeriod, now = new Date()) {
  const cacheKey = `${period}:${manilaDate(now)}`;
  const cached = expenseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const value = queryOverviewExpenses(period, now);
  expenseCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  void value.catch(() => {
    if (expenseCache.get(cacheKey)?.value === value) expenseCache.delete(cacheKey);
  });
  if (expenseCache.size > 16) {
    for (const [key, entry] of expenseCache) {
      if (entry.expiresAt <= Date.now()) expenseCache.delete(key);
    }
    while (expenseCache.size > 16) {
      const oldestKey = expenseCache.keys().next().value;
      if (!oldestKey) break;
      expenseCache.delete(oldestKey);
    }
  }
  return value;
}

async function queryOverviewExpenses(period: OverviewPeriod, now: Date) {
  const range = resolveOverviewPeriod(period, manilaDate(now));
  const conditions: SQL[] = [eq(tonerTransactions.type, "Request")];
  if (range.fromDate) conditions.push(gte(tonerTransactions.date, range.fromDate));
  conditions.push(lte(tonerTransactions.date, range.toDate));

  const rows = await db.select({
    date: tonerTransactions.date,
    departmentId: tonerTransactions.departmentId,
    departmentName: departments.name,
    locationId: tonerTransactions.locationId,
    locationName: locations.name,
    tonerTypeId: tonerTransactions.tonerTypeId,
    tonerTypeName: tonerTypes.name,
    unitCost: tonerTypes.unitCost,
    quantity: tonerTransactions.quantity,
  }).from(tonerTransactions)
    .innerJoin(tonerTypes, eq(tonerTransactions.tonerTypeId, tonerTypes.id))
    .leftJoin(departments, eq(tonerTransactions.departmentId, departments.id))
    .leftJoin(locations, eq(tonerTransactions.locationId, locations.id))
    .where(and(...conditions));

  return {
    period,
    label: range.label,
    summary: summarizeTonerExpenses(rows.map((row) => ({
      date: row.date,
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      locationId: row.locationId,
      locationName: row.locationName,
      tonerTypeId: row.tonerTypeId,
      tonerTypeName: row.tonerTypeName,
      quantity: row.quantity,
      unitCostCents: amountToCents(row.unitCost),
    }))),
  };
}
