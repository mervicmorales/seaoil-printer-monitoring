import "server-only";

import { and, asc, desc, eq, gte, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  itsNames,
  locations,
  tonerTransactions,
  tonerTypes,
} from "@/db/schema";
import {
  MAX_TONER_EXPENSE_EXPORT_ROWS,
  type TonerExpenseExportFilters,
  type TonerExpenseExportReport,
  type TonerExpenseLookupFilter,
} from "@/lib/toner-expense-export";
import { amountToCents, summarizeTonerExpenses } from "@/lib/toner-expenses";

type LookupOption = { id: number; name: string };

export async function getTonerExpenseExportReport(
  filters: TonerExpenseExportFilters,
): Promise<TonerExpenseExportReport> {
  const conditions: SQL[] = [eq(tonerTransactions.type, "Request")];
  if (filters.dateFrom) conditions.push(gte(tonerTransactions.date, filters.dateFrom));
  if (filters.dateTo) conditions.push(lte(tonerTransactions.date, filters.dateTo));
  addLookupCondition(conditions, filters.department, tonerTransactions.departmentId);
  addLookupCondition(conditions, filters.location, tonerTransactions.locationId);
  addLookupCondition(conditions, filters.tonerType, tonerTransactions.tonerTypeId);
  addLookupCondition(conditions, filters.itsName, tonerTransactions.itsNameId);

  const [rows, departmentOptions, locationOptions, tonerTypeOptions, itsNameOptions] = await Promise.all([
    db
      .select({
        transactionId: tonerTransactions.id,
        groupId: tonerTransactions.groupId,
        date: tonerTransactions.date,
        ticketReference: tonerTransactions.ticketReference,
        departmentId: tonerTransactions.departmentId,
        departmentName: departments.name,
        locationId: tonerTransactions.locationId,
        locationName: locations.name,
        tonerTypeId: tonerTransactions.tonerTypeId,
        tonerTypeName: tonerTypes.name,
        unitCost: tonerTypes.unitCost,
        quantity: tonerTransactions.quantity,
        itsNameId: tonerTransactions.itsNameId,
        itsName: itsNames.name,
        remarks: tonerTransactions.remarks,
        recordedAt: tonerTransactions.createdAt,
      })
      .from(tonerTransactions)
      .innerJoin(tonerTypes, eq(tonerTransactions.tonerTypeId, tonerTypes.id))
      .leftJoin(departments, eq(tonerTransactions.departmentId, departments.id))
      .leftJoin(locations, eq(tonerTransactions.locationId, locations.id))
      .leftJoin(itsNames, eq(tonerTransactions.itsNameId, itsNames.id))
      .where(and(...conditions))
      .orderBy(desc(tonerTransactions.date), desc(tonerTransactions.id))
      .limit(MAX_TONER_EXPENSE_EXPORT_ROWS + 1),
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.name)),
    db.select({ id: locations.id, name: locations.name }).from(locations).orderBy(asc(locations.name)),
    db.select({ id: tonerTypes.id, name: tonerTypes.name }).from(tonerTypes).orderBy(asc(tonerTypes.name)),
    db.select({ id: itsNames.id, name: itsNames.name }).from(itsNames).orderBy(asc(itsNames.name)),
  ]);

  const exceededLimit = rows.length > MAX_TONER_EXPENSE_EXPORT_ROWS;
  const limitedRows = rows.slice(0, MAX_TONER_EXPENSE_EXPORT_ROWS);
  const expenseRows = limitedRows.map((row) => {
    const unitCostCents = amountToCents(row.unitCost);
    const quantity = Math.max(0, Math.trunc(row.quantity));
    return {
      transactionId: row.transactionId,
      groupId: row.groupId,
      date: row.date,
      ticketReference: cleanText(row.ticketReference),
      department: row.departmentName?.trim() || "Unassigned department",
      location: row.locationName?.trim() || "Unassigned location",
      tonerType: row.tonerTypeName,
      quantity,
      unitCostCents,
      totalExpenseCents: quantity * unitCostCents,
      itsName: row.itsName?.trim() || "Unassigned ITS name",
      remarks: cleanText(row.remarks),
      recordedAt: row.recordedAt,
    };
  });

  const summary = summarizeTonerExpenses(limitedRows.map((row) => ({
    date: row.date,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    locationId: row.locationId,
    locationName: row.locationName,
    tonerTypeId: row.tonerTypeId,
    tonerTypeName: row.tonerTypeName,
    quantity: row.quantity,
    unitCostCents: amountToCents(row.unitCost),
  })));

  return {
    filters,
    filterLabels: {
      period: periodLabel(filters),
      department: lookupLabel(filters.department, departmentOptions, "All departments", "Unassigned department"),
      location: lookupLabel(filters.location, locationOptions, "All locations", "Unassigned location"),
      tonerType: lookupLabel(filters.tonerType, tonerTypeOptions, "All toner types", "Unassigned toner type"),
      itsName: lookupLabel(filters.itsName, itsNameOptions, "All ITS names", "Unassigned ITS name"),
    },
    rows: expenseRows,
    summary,
    exceededLimit,
  };
}

function addLookupCondition(
  conditions: SQL[],
  value: TonerExpenseLookupFilter,
  column:
    | typeof tonerTransactions.departmentId
    | typeof tonerTransactions.locationId
    | typeof tonerTransactions.tonerTypeId
    | typeof tonerTransactions.itsNameId,
) {
  if (value === "unassigned") conditions.push(isNull(column));
  else if (value !== null) conditions.push(eq(column, value));
}

function lookupLabel(
  filter: TonerExpenseLookupFilter,
  options: LookupOption[],
  allLabel: string,
  unassignedLabel: string,
) {
  if (filter === null) return allLabel;
  if (filter === "unassigned") return unassignedLabel;
  return options.find((option) => option.id === filter)?.name ?? `Unknown (${filter})`;
}

function periodLabel(filters: TonerExpenseExportFilters) {
  if (filters.allTime) return "All recorded requests";
  if (filters.dateFrom && filters.dateTo) {
    return `${displayDate(filters.dateFrom)} to ${displayDate(filters.dateTo)}`;
  }
  if (filters.dateFrom) return `From ${displayDate(filters.dateFrom)}`;
  if (filters.dateTo) return `Through ${displayDate(filters.dateTo)}`;
  return "All recorded requests";
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function cleanText(value: string | null) {
  const text = value?.trim();
  return text && !["NA", "N/A"].includes(text.toUpperCase()) ? text : "";
}
