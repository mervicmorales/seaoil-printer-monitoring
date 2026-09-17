import Link from "next/link";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Droplets,
  Filter,
  MapPin,
  PackageCheck,
  ReceiptText,
  type IconNode,
} from "lucide";
import { and, asc, desc, eq, gte, isNull, lte, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  itsNames,
  locations,
  tonerTransactions,
  tonerTypes,
} from "@/db/schema";
import CollapsibleFilterPanel from "@/components/CollapsibleFilterPanel";
import { Card, EmptyState, IconGlyph, PageHeader, StatCard } from "@/components/ui";
import TonerExpenseExportDialog from "@/app/(app)/toner-expenses/TonerExpenseExportDialog";
import { tonerExpenseExportPreview } from "@/lib/toner-expense-export";
import {
  amountToCents,
  summarizeTonerExpenses,
  type ExpenseBreakdown,
} from "@/lib/toner-expenses";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | undefined>;
type LookupFilter = number | "unassigned" | null;
type LookupOption = { id: number; name: string };

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-PH");

export default async function TonerExpensesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireModuleFullAccess("toner_expenses");
  const access = await getModuleAccessMap(session.id, session.role);
  const sp = await searchParams;
  const today = manilaDate();
  const isAllTime = sp.allTime === "1";
  const dateFrom = isAllTime ? "" : (sp.dateFrom ?? `${today.slice(0, 4)}-01-01`);
  const dateTo = isAllTime ? "" : (sp.dateTo ?? today);
  const departmentFilter = parseLookupFilter(sp.department);
  const locationFilter = parseLookupFilter(sp.location);
  const tonerTypeFilter = parseLookupFilter(sp.tonerType);
  const itsNameFilter = parseLookupFilter(sp.itsName);

  const conditions: SQL[] = [eq(tonerTransactions.type, "Request")];
  if (dateFrom) conditions.push(gte(tonerTransactions.date, dateFrom));
  if (dateTo) conditions.push(lte(tonerTransactions.date, dateTo));
  addLookupCondition(conditions, departmentFilter, tonerTransactions.departmentId);
  addLookupCondition(conditions, locationFilter, tonerTransactions.locationId);
  addLookupCondition(conditions, tonerTypeFilter, tonerTransactions.tonerTypeId);
  addLookupCondition(conditions, itsNameFilter, tonerTransactions.itsNameId);

  const [rows, allDepartments, allLocations, allTonerTypes, allItsNames] = await Promise.all([
    db
      .select({
        date: tonerTransactions.date,
        departmentId: tonerTransactions.departmentId,
        departmentName: departments.name,
        locationId: tonerTransactions.locationId,
        locationName: locations.name,
        tonerTypeId: tonerTransactions.tonerTypeId,
        tonerTypeName: tonerTypes.name,
        unitCost: tonerTypes.unitCost,
        quantity: tonerTransactions.quantity,
      })
      .from(tonerTransactions)
      .innerJoin(tonerTypes, eq(tonerTransactions.tonerTypeId, tonerTypes.id))
      .leftJoin(departments, eq(tonerTransactions.departmentId, departments.id))
      .leftJoin(locations, eq(tonerTransactions.locationId, locations.id))
      .where(and(...conditions))
      .orderBy(desc(tonerTransactions.date), desc(tonerTransactions.id)),
    db.select({ id: departments.id, name: departments.name }).from(departments).orderBy(asc(departments.name)),
    db.select({ id: locations.id, name: locations.name }).from(locations).orderBy(asc(locations.name)),
    db.select({ id: tonerTypes.id, name: tonerTypes.name }).from(tonerTypes).orderBy(asc(tonerTypes.name)),
    db.select({ id: itsNames.id, name: itsNames.name }).from(itsNames).orderBy(asc(itsNames.name)),
  ]);

  const summary = summarizeTonerExpenses(rows.map((row) => ({
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
  const priceCoverage = summary.requestLines
    ? Math.round((summary.pricedRequestLines / summary.requestLines) * 100)
    : 0;
  const activeFilterCount = [
    departmentFilter,
    locationFilter,
    tonerTypeFilter,
    itsNameFilter,
    dateFrom && dateFrom !== `${today.slice(0, 4)}-01-01` ? dateFrom : "",
    dateTo && dateTo !== today ? dateTo : "",
    isAllTime ? "all-time" : "",
  ].filter(Boolean).length;
  const chartDepartments = summary.departments.slice(0, 8);
  const chartMonths = summary.months.slice(-12);

  return (
    <div className="pb-8">
      <PageHeader
        title="Toner Expenses"
        subtitle="Estimated toner spending by department, based on recorded requests and current unit costs."
        actions={session.role !== "employee" ? (
          <TonerExpenseExportDialog
            initialFilters={{
              allTime: isAllTime,
              dateFrom,
              dateTo,
              department: lookupValue(departmentFilter),
              location: lookupValue(locationFilter),
              tonerType: lookupValue(tonerTypeFilter),
              itsName: lookupValue(itsNameFilter),
            }}
            initialPreview={tonerExpenseExportPreview(summary)}
            departments={allDepartments}
            locations={allLocations}
            tonerTypes={allTonerTypes}
            itsNames={allItsNames}
          />
        ) : undefined}
      />

      {summary.unpricedTonerTypes.length > 0 && (
        <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-amber-600 shadow-sm">
              <IconGlyph icon={CircleDollarSign} size={18} />
            </span>
            <div>
              <p className="text-sm font-bold">Some toner types do not have a unit cost</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-800">
                Their requests are included in unit totals but add ₱0.00 to expenses: {summary.unpricedTonerTypes.join(", ")}.
              </p>
            </div>
          </div>
          {access.system && (
            <Link href="/system?tab=toner" className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-3.5 text-xs font-bold text-amber-800 shadow-sm transition hover:bg-amber-100">
              Set unit costs
            </Link>
          )}
        </div>
      )}

      <section aria-label="Expense overview" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard compact label="Estimated expense" value={formatCurrency(summary.totalExpenseCents)} accent="#014171" icon={CircleDollarSign} />
        <StatCard compact label="Units requested" value={numberFormatter.format(summary.totalUnits)} accent="#0f766e" icon={PackageCheck} />
        <StatCard compact label="Request records" value={numberFormatter.format(summary.requestLines)} accent="#7c3aed" icon={ReceiptText} />
        <StatCard compact label="Price coverage" value={`${priceCoverage}%`} accent={priceCoverage === 100 ? "#059669" : "#d97706"} icon={Droplets} />
      </section>

      <CollapsibleFilterPanel activeFilterCount={activeFilterCount} defaultOpen={false} className="my-5">
        <form method="get" className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <DateField name="dateFrom" label="Date from" value={dateFrom} />
            <DateField name="dateTo" label="Date to" value={dateTo} />
            <FilterSelect name="department" label="Department" value={lookupValue(departmentFilter)} options={allDepartments} includeUnassigned />
            <FilterSelect name="location" label="Location" value={lookupValue(locationFilter)} options={allLocations} includeUnassigned />
            <FilterSelect name="tonerType" label="Toner type" value={lookupValue(tonerTypeFilter)} options={allTonerTypes} />
            <FilterSelect name="itsName" label="ITS name" value={lookupValue(itsNameFilter)} options={allItsNames} includeUnassigned />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="flex flex-wrap gap-2">
              <Link href="/toner-expenses" className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Current year</Link>
              <Link href="/toner-expenses?allTime=1" className="inline-flex h-9 items-center rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">All time</Link>
            </div>
            <button type="submit" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#012c50]">
              <IconGlyph icon={Filter} size={15} />
              Apply filters
            </button>
          </div>
        </form>
      </CollapsibleFilterPanel>

      {summary.requestLines === 0 ? (
        <Card><EmptyState message="No toner requests match the selected filters." /></Card>
      ) : (
        <>
          <section className="grid gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <SectionHeading icon={Building2} eyebrow="Department comparison" title="Highest estimated expense" subtitle="Top departments in the selected period" />
              <div className="space-y-4 p-5">
                {chartDepartments.map((row, index) => (
                  <HorizontalBar key={row.key} row={row} max={chartDepartments[0]?.expenseCents ?? 0} rank={index + 1} />
                ))}
              </div>
            </Card>

            <Card className="overflow-hidden">
              <SectionHeading icon={BarChart3} eyebrow="Expense trend" title="Monthly toner expense" subtitle="Latest 12 months within the selected period" />
              <MonthlyChart rows={chartMonths} />
            </Card>
          </section>

          <section className="mt-5">
            <Card className="flex h-[32rem] min-h-0 flex-col overflow-hidden">
              <SectionHeading icon={Building2} eyebrow="Department allocation" title="Expense by department" subtitle={`${summary.departments.length} department${summary.departments.length === 1 ? "" : "s"} represented`} />
              <div className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
                <table className="w-full table-fixed text-left text-xs 2xl:text-sm">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[12%]" />
                    <col className="w-[9%]" />
                    <col className="w-[18%]" />
                    <col className="w-[9%]" />
                    <col className="w-[26%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-y border-slate-200 bg-slate-50/95 text-[11px] uppercase tracking-[0.055em] text-slate-500 backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-3 2xl:px-5">Department</th>
                      <th className="whitespace-nowrap px-2 py-3 text-right text-[10px] tracking-[0.03em] 2xl:text-[11px]">Requests</th>
                      <th className="px-2 py-3 text-right">Units</th>
                      <th className="px-2 py-3 leading-4 2xl:px-4">Top toner</th>
                      <th className="px-2 py-3 text-right">Share</th>
                      <th className="px-3 py-3 text-right 2xl:px-5">Expense</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.departments.map((row) => (
                      <tr key={row.key} className="transition hover:bg-sky-50/40">
                        <td className="break-words px-3 py-3.5 font-semibold leading-5 text-slate-800 2xl:px-5">{row.name}</td>
                        <td className="px-2 py-3.5 text-right tabular-nums text-slate-600">{numberFormatter.format(row.requestLines)}</td>
                        <td className="px-2 py-3.5 text-right tabular-nums text-slate-600">{numberFormatter.format(row.units)}</td>
                        <td className="break-words px-2 py-3.5 text-slate-600 2xl:px-4">{row.topToner}</td>
                        <td className="px-2 py-3.5 text-right tabular-nums text-slate-600">{percentage(row.expenseCents, summary.totalExpenseCents)}%</td>
                        <td className="break-words px-3 py-3.5 text-right font-bold tabular-nums text-[#014171] 2xl:px-5">{formatCurrency(row.expenseCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          <section className="mt-5 grid items-start gap-5 xl:grid-cols-2">
            <Card className="flex h-[32rem] min-h-0 flex-col overflow-hidden">
              <SectionHeading icon={MapPin} eyebrow="Location allocation" title="Expense by location" subtitle={`${summary.locations.length} location${summary.locations.length === 1 ? "" : "s"} represented`} />
              <div className="min-h-0 w-full flex-1 overflow-y-auto overscroll-contain">
                <table className="w-full table-fixed text-left text-xs 2xl:text-sm">
                  <colgroup>
                    <col className="w-[34%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[28%]" />
                  </colgroup>
                  <thead className="sticky top-0 z-10 border-y border-slate-200 bg-slate-50/95 text-[11px] uppercase tracking-[0.055em] text-slate-500 backdrop-blur-sm">
                    <tr>
                      <th className="px-3 py-3 2xl:px-5">Location</th>
                      <th className="whitespace-nowrap px-2 py-3 text-right text-[10px] tracking-[0.03em] 2xl:text-[11px]">Requests</th>
                      <th className="px-2 py-3 text-right">Units</th>
                      <th className="px-2 py-3 text-right">Share</th>
                      <th className="px-3 py-3 text-right 2xl:px-5">Expense</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {summary.locations.map((row) => (
                      <tr key={row.key} className="transition hover:bg-sky-50/40">
                        <td className="break-words px-3 py-3.5 font-semibold leading-5 text-slate-800 2xl:px-5">{row.name}</td>
                        <td className="px-2 py-3.5 text-right tabular-nums text-slate-600">{numberFormatter.format(row.requestLines)}</td>
                        <td className="px-2 py-3.5 text-right tabular-nums text-slate-600">{numberFormatter.format(row.units)}</td>
                        <td className="px-2 py-3.5 text-right tabular-nums text-slate-600">{percentage(row.expenseCents, summary.totalExpenseCents)}%</td>
                        <td className="break-words px-3 py-3.5 text-right font-bold tabular-nums text-[#014171] 2xl:px-5">{formatCurrency(row.expenseCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="flex h-[32rem] min-h-0 flex-col overflow-hidden">
              <SectionHeading icon={Droplets} eyebrow="Toner mix" title="Cost by toner type" subtitle="Units and estimated expense" />
              <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto overscroll-contain px-5">
                {summary.tonerTypes.map((row) => (
                  <div key={row.key} className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{row.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{numberFormatter.format(row.units)} units · {numberFormatter.format(row.requestLines)} request records</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold tabular-nums text-[#014171]">{formatCurrency(row.expenseCents)}</p>
                    </div>
                    <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-[#0b70a8]" style={{ width: `${percentage(row.expenseCents, summary.totalExpenseCents)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        </>
      )}

      <p className="mt-4 text-xs leading-5 text-slate-500">
        Expense figures are estimates calculated as requested quantity × the toner type&apos;s current unit cost. Updating a unit cost recalculates historical estimates; transaction records are not changed.
      </p>
    </div>
  );
}

function SectionHeading({
  icon,
  eyebrow,
  title,
  subtitle,
}: {
  icon: IconNode;
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
        <IconGlyph icon={icon} size={18} />
      </span>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">{eyebrow}</p>
        <h2 className="mt-0.5 text-base font-bold text-[#014171]">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

function HorizontalBar({ row, max, rank }: { row: ExpenseBreakdown; max: number; rank: number }) {
  const width = max > 0 ? Math.max(3, Math.round((row.expenseCents / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <p className="min-w-0 truncate font-semibold text-slate-700"><span className="mr-2 text-slate-400">{rank}.</span>{row.name}</p>
        <p className="shrink-0 font-bold tabular-nums text-[#014171]">{formatCurrency(row.expenseCents)}</p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-[#014171] to-[#20a6d8]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MonthlyChart({ rows }: { rows: ExpenseBreakdown[] }) {
  const max = Math.max(...rows.map((row) => row.expenseCents), 0);
  if (!rows.length) return <EmptyState message="No monthly activity is available for this period." />;
  return (
    <div className="p-5">
      <div className="flex h-52 items-end gap-2 border-b border-slate-200 px-1 pt-5 sm:gap-3">
        {rows.map((row) => {
          const height = max > 0 ? Math.max(5, Math.round((row.expenseCents / max) * 100)) : 3;
          return (
            <div key={row.key} className="group flex min-w-0 flex-1 flex-col items-center justify-end self-stretch">
              <div className="relative flex w-full flex-1 items-end justify-center">
                <span className="pointer-events-none absolute -top-5 z-10 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-semibold text-white shadow-lg group-hover:block">
                  {formatCurrency(row.expenseCents)}
                </span>
                <div className="w-full max-w-9 rounded-t-lg bg-gradient-to-t from-[#014171] to-[#38bdf8] transition group-hover:brightness-110" style={{ height: `${height}%` }} />
              </div>
              <span className="mt-2 max-w-full truncate text-[9px] font-semibold text-slate-500 sm:text-[10px]">{formatMonth(row.key)}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
        <span>{formatMonth(rows[0].key, true)}</span>
        <span className="font-semibold text-slate-700">Total {formatCurrency(rows.reduce((sum, row) => sum + row.expenseCents, 0))}</span>
        <span>{formatMonth(rows[rows.length - 1].key, true)}</span>
      </div>
    </div>
  );
}

function DateField({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconGlyph icon={CalendarDays} size={15} /></span>
        <input type="date" name={name} defaultValue={value} className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15" />
      </span>
    </label>
  );
}

function FilterSelect({
  name,
  label,
  value,
  options,
  includeUnassigned = false,
}: {
  name: string;
  label: string;
  value: string;
  options: LookupOption[];
  includeUnassigned?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <select name={name} defaultValue={value} className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15">
        <option value="">All {label.toLowerCase()}s</option>
        {includeUnassigned && <option value="unassigned">Unassigned</option>}
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select>
    </label>
  );
}

function addLookupCondition(
  conditions: SQL[],
  value: LookupFilter,
  column:
    | typeof tonerTransactions.departmentId
    | typeof tonerTransactions.locationId
    | typeof tonerTransactions.tonerTypeId
    | typeof tonerTransactions.itsNameId,
) {
  if (value === "unassigned") conditions.push(isNull(column));
  else if (value !== null) conditions.push(eq(column, value));
}

function parseLookupFilter(value: string | undefined): LookupFilter {
  if (value === "unassigned") return value;
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function lookupValue(value: LookupFilter) {
  return value === null ? "" : String(value);
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}

function formatCurrency(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function formatMonth(month: string, long = false) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-PH", { month: long ? "short" : "narrow", year: long ? "numeric" : undefined, timeZone: "UTC" }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date());
}
