"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  CircleDollarSign,
  Filter,
  FilterX,
  PackageCheck,
  ShoppingCart,
  Truck,
  X,
} from "lucide";
import { Card, EmptyState, IconGlyph, PageHeader } from "@/components/ui";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import SearchableDropdown from "@/components/SearchableDropdown";
import TonerExpenseExportDialog from "./TonerExpenseExportDialog";
import { CostCenterVisual, ExpenseFlowVisual } from "./TonerExpenseVisuals";
import { tonerExpenseExportPreview } from "@/lib/toner-expense-export";
import { summarizeTonerExpenses } from "@/lib/toner-expenses";
import {
  groupTonerRequests,
  type TonerExpenseViewRecord,
  type TonerRequestGroup,
} from "@/lib/toner-expense-groups";

type LookupOption = { id: number; name: string };
type SubunitLookupOption = LookupOption & { departmentId: number };
type FilterState = {
  allTime: boolean;
  dateFrom: string;
  dateTo: string;
  department: string;
  subunit: string;
  costCenter: string;
  location: string;
  tonerType: string;
  itsName: string;
};

const currency = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const integer = new Intl.NumberFormat("en-PH");
const fieldClassName = "h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/10 disabled:bg-slate-100 disabled:text-slate-400";

export default function TonerExpenseExplorer({
  records,
  deliveryRecords,
  initialFilters,
  departments,
  subunits,
  costCenters,
  locations,
  tonerTypes,
  itsNames,
  canManageCosts,
}: {
  records: TonerExpenseViewRecord[];
  deliveryRecords: TonerExpenseViewRecord[];
  initialFilters: FilterState;
  departments: LookupOption[];
  subunits: SubunitLookupOption[];
  costCenters: LookupOption[];
  locations: LookupOption[];
  tonerTypes: LookupOption[];
  itsNames: LookupOption[];
  canManageCosts: boolean;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedCostCenters, setExpandedCostCenters] = useState<Set<string>>(new Set());
  const availableSubunits = useMemo(() => (
    filters.department && filters.department !== "unassigned"
      ? subunits.filter((item) => String(item.departmentId) === filters.department)
      : subunits
  ), [filters.department, subunits]);
  const filteredRecords = useMemo(() => records.filter((record) => matchesFilters(record, filters)), [records, filters]);
  const filteredDeliveryRecords = useMemo(() => deliveryRecords.filter((record) => matchesFilters(record, filters)), [deliveryRecords, filters]);
  const summary = useMemo(() => summarizeTonerExpenses(filteredRecords), [filteredRecords]);
  const deliverySummary = useMemo(() => summarizeTonerExpenses(filteredDeliveryRecords), [filteredDeliveryRecords]);
  const grouped = useMemo(() => groupTonerRequests(filteredRecords), [filteredRecords]);
  const costCenterCount = useMemo(() => new Set(filteredRecords.map((record) => record.costCenterId == null ? "unassigned" : String(record.costCenterId))).size, [filteredRecords]);
  const priceCoverage = summary.requestLines ? Math.round((summary.pricedRequestLines / summary.requestLines) * 100) : 0;
  const deliveryPriceCoverage = deliverySummary.requestLines ? Math.round((deliverySummary.pricedRequestLines / deliverySummary.requestLines) * 100) : 0;
  const unpricedTonerTypes = useMemo(() => [...new Set([...summary.unpricedTonerTypes, ...deliverySummary.unpricedTonerTypes])].sort((left, right) => left.localeCompare(right)), [deliverySummary.unpricedTonerTypes, summary.unpricedTonerTypes]);
  const activeFilters = [filters.department, filters.subunit, filters.costCenter, filters.location, filters.tonerType, filters.itsName].filter(Boolean).length + (filters.allTime ? 0 : 1);

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (event.target instanceof HTMLElement && event.target.getAttribute("role") === "combobox") return;
      setFiltersOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filtersOpen]);

  function updateFilter<Key extends keyof FilterState>(key: Key, value: FilterState[Key]) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "department" && current.department !== value) next.subunit = "";
      return next;
    });
    setExpanded(new Set());
    setExpandedCostCenters(new Set());
  }

  function resetFilters() {
    setFilters({ ...initialFilters, department: "", subunit: "", costCenter: "", location: "", tonerType: "", itsName: "" });
    setExpanded(new Set());
    setExpandedCostCenters(new Set());
  }

  function toggleDepartment(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCostCenter(key: string) {
    setExpandedCostCenters((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title="Toner Expenses"
        actions={(
          <TonerExpenseExportDialog
            initialFilters={filters}
            initialPreview={tonerExpenseExportPreview(summary)}
            departments={departments}
            subunits={subunits}
            costCenters={costCenters}
            locations={locations}
            tonerTypes={tonerTypes}
            itsNames={itsNames}
          />
        )}
      />

      <div className="fixed right-0 top-[5.75rem] z-50">
        <button
          type="button"
          aria-label="Filter toner expenses"
          aria-expanded={filtersOpen}
          aria-controls="toner-expense-filters"
          onClick={() => setFiltersOpen((open) => !open)}
          className={`group relative flex h-9 w-9 items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-white/95 text-[#014171] shadow-md backdrop-blur transition hover:bg-white hover:shadow-lg ${filtersOpen ? "bg-sky-50 ring-1 ring-[#014171]/10" : ""}`}
        >
          <span className="transition-transform duration-200 group-hover:scale-110 group-focus-visible:scale-110">
            <IconGlyph icon={Filter} size={14} />
          </span>
          {!filtersOpen && (
            <span className="pointer-events-none absolute right-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 translate-x-2 scale-95 whitespace-nowrap rounded-md bg-[#014171] px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100 group-focus-visible:opacity-100">
              Filter Expenses
            </span>
          )}
        </button>

        {filtersOpen && (
          <section
            id="toner-expense-filters"
            aria-label="Toner expense filters"
            className="absolute right-[calc(100%+0.5rem)] top-0 max-h-[calc(100vh-12rem)] w-[min(46rem,calc(100vw-4.5rem))] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white/98 shadow-[0_20px_55px_rgba(15,23,42,0.2)] backdrop-blur"
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-5">
              <div className="flex min-w-0 items-start gap-2.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#014171]"><IconGlyph icon={Filter} size={15} /></span>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-slate-800">Filter toner expenses</h2>
                  <p className="mt-0.5 text-[10px] text-slate-500">Results and totals update immediately.</p>
                </div>
              </div>
              <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close filters" className="flex size-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><IconGlyph icon={X} size={15} /></button>
            </div>

            <div className="p-4 sm:p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <FilterField label="Department" value={filters.department} onChange={(value) => updateFilter("department", value)} options={departments} includeUnassigned />
                <FilterField label="Subunit" value={filters.subunit} onChange={(value) => updateFilter("subunit", value)} options={availableSubunits} includeUnassigned />
                <FilterField label="Cost center" value={filters.costCenter} onChange={(value) => updateFilter("costCenter", value)} options={costCenters} includeUnassigned />
                <FilterField label="Office" value={filters.location} onChange={(value) => updateFilter("location", value)} options={locations} includeUnassigned />
                <FilterField label="Toner type" value={filters.tonerType} onChange={(value) => updateFilter("tonerType", value)} options={tonerTypes} />
                <FilterField label="Requested by" value={filters.itsName} onChange={(value) => updateFilter("itsName", value)} options={itsNames} includeUnassigned />
              </div>
              <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="Date from"><input type="date" value={filters.dateFrom} disabled={filters.allTime} onChange={(event) => updateFilter("dateFrom", event.target.value)} className={fieldClassName} /></Field>
                <Field label="Date to"><input type="date" value={filters.dateTo} disabled={filters.allTime} onChange={(event) => updateFilter("dateTo", event.target.value)} className={fieldClassName} /></Field>
                <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"><input type="checkbox" checked={filters.allTime} onChange={(event) => updateFilter("allTime", event.target.checked)} className="size-4 rounded border-slate-300 text-[#014171] focus:ring-[#014171]" />All time</label>
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/95 px-4 py-3 backdrop-blur sm:px-5">
              <p className="text-[10px] font-semibold text-slate-500">{activeFilters} active filter{activeFilters === 1 ? "" : "s"}</p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={resetFilters} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-slate-900"><IconGlyph icon={FilterX} size={14} />Reset</button>
                <button type="button" onClick={() => setFiltersOpen(false)} className="inline-flex h-9 items-center justify-center rounded-md bg-[#014171] px-4 text-xs font-bold text-white transition hover:bg-[#025486]">Done</button>
              </div>
            </div>
          </section>
        )}
      </div>

      <section aria-labelledby="expense-summary-heading" className="overflow-hidden rounded-lg border border-[#dfe6ee] bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="expense-summary-heading" className="text-sm font-bold text-[#014171]">Cost Summary</h2>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5"><i className={`size-2 rounded-full ${priceCoverage === 100 ? "bg-emerald-500" : "bg-amber-400"}`} />{priceCoverage}% request price coverage</span>
            <span className="flex items-center gap-1.5"><i className={`size-2 rounded-full ${deliveryPriceCoverage === 100 ? "bg-emerald-500" : "bg-amber-400"}`} />{deliveryPriceCoverage}% delivery price coverage</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Estimated request cost" value={summary.totalExpenseCents / 100} format="currency" icon={CircleDollarSign} color="text-[#014171]" description="Requested quantity × current unit cost" />
          <SummaryMetric label="Estimated delivery value" value={deliverySummary.totalExpenseCents / 100} format="currency" icon={ShoppingCart} color="text-emerald-700" description="Delivered quantity × current unit cost" />
          <SummaryMetric label="Units requested" value={summary.totalUnits} icon={PackageCheck} color="text-violet-700" description={`${integer.format(summary.requestLines)} request ${pluralize(summary.requestLines, "record")}`} />
          <SummaryMetric label="Units delivered" value={deliverySummary.totalUnits} icon={Truck} color="text-sky-700" description={`${integer.format(deliverySummary.requestLines)} delivery ${pluralize(deliverySummary.requestLines, "record")}`} />
        </div>
      </section>

      {unpricedTonerTypes.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-amber-600"><IconGlyph icon={CircleDollarSign} size={16} /></span>
            <div><p className="text-xs font-bold">Missing unit costs</p><p className="mt-0.5 text-xs leading-5 text-amber-800">These toner transactions count as units but add ₱0.00 to estimates: {unpricedTonerTypes.join(", ")}.</p></div>
          </div>
          {canManageCosts && <Link href="/system/toner-types" className="shrink-0 text-xs font-bold text-amber-900 underline decoration-amber-400 underline-offset-4">Set unit costs</Link>}
        </div>
      )}

      <div className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(20rem,0.8fr)]">
        <ExpenseFlowVisual requests={filteredRecords} deliveries={filteredDeliveryRecords} />
        <CostCenterVisual requests={filteredRecords} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
          <div>
            <h2 className="text-base font-bold text-[#014171]">Requests by Department</h2>
            <p className="mt-1 text-xs text-slate-500">Select a department row to see every requested cost center and its toner types.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500"><IconGlyph icon={CircleDollarSign} size={14} /><span>{integer.format(costCenterCount)} {pluralize(costCenterCount, "cost center")} in this view</span></div>
        </div>

        <div className="flex flex-col gap-1 border-b border-slate-200 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span>Showing <strong className="text-slate-800">{grouped.length}</strong> {pluralize(grouped.length, "department")}, <strong className="text-slate-800">{costCenterCount}</strong> {pluralize(costCenterCount, "cost center")}, and <strong className="text-slate-800">{summary.tonerTypes.length}</strong> {pluralize(summary.tonerTypes.length, "toner type")}</span>
          <span>{activeFilters} active filter{activeFilters === 1 ? "" : "s"}</span>
        </div>

        {grouped.length ? (
          <div className="max-h-[38rem] overflow-auto overscroll-contain">
            <table className="w-full min-w-[760px] table-fixed text-left text-[13px]">
              <colgroup><col className="w-[28%]" /><col className="w-[36%]" /><col className="w-[11%]" /><col className="w-[10%]" /><col className="w-[15%]" /></colgroup>
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500 backdrop-blur-sm">
                <tr><th className="px-5 py-3">Department / Cost Center</th><th className="px-3 py-3">Toner type requests</th><th className="px-3 py-3 text-right">Records</th><th className="px-3 py-3 text-right">Units</th><th className="px-5 py-3 text-right">Estimated expense</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grouped.map((department) => {
                  const isExpanded = expanded.has(department.key);
                  return (
                    <DepartmentRows
                      key={department.key}
                      department={department}
                      expanded={isExpanded}
                      expandedCostCenters={expandedCostCenters}
                      onToggle={() => toggleDepartment(department.key)}
                      onToggleCostCenter={toggleCostCenter}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              message="No toner requests match the selected filters."
              action={activeFilters > 0 ? (
                <button type="button" onClick={resetFilters} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Reset filters</button>
              ) : undefined}
            />
          </div>
        )}
      </Card>

      <p className="text-xs leading-5 text-slate-500">Expense figures are estimates based on current toner unit costs. Changing a unit cost recalculates historical estimates without changing the original request records.</p>
    </div>
  );
}

function DepartmentRows({
  department,
  expanded,
  expandedCostCenters,
  onToggle,
  onToggleCostCenter,
}: {
  department: ReturnType<typeof groupTonerRequests>[number];
  expanded: boolean;
  expandedCostCenters: Set<string>;
  onToggle: () => void;
  onToggleCostCenter: (key: string) => void;
}) {
  return (
    <>
      <tr className={`transition ${expanded ? "bg-sky-50/70" : "bg-white hover:bg-slate-50"}`}>
        <td className="px-5 py-3.5"><button type="button" onClick={onToggle} aria-expanded={expanded} className="group flex w-full items-center gap-3 text-left"><span className={`flex size-7 shrink-0 items-center justify-center rounded-lg border transition ${expanded ? "border-[#014171] bg-[#014171] text-white" : "-rotate-90 border-slate-200 bg-white text-slate-500 group-hover:border-slate-300"}`}><IconGlyph icon={ChevronDown} size={14} /></span><span className="min-w-0"><span className="block truncate font-bold text-slate-800">{department.name}</span><span className="mt-0.5 block text-[11px] text-slate-500">{department.costCenters.length} {pluralize(department.costCenters.length, "cost center")} · {expanded ? "Hide details" : "View cost centers"}</span></span></button></td>
        <td className="px-3 py-3.5"><TonerPills rows={department.tonerTypes} /></td>
        <NumberCell value={department.requestLines} />
        <NumberCell value={department.units} strong />
        <td className="px-5 py-3.5 text-right font-bold tabular-nums text-[#014171]">{currency.format(department.expenseCents / 100)}</td>
      </tr>
      {expanded && department.costCenters.map((costCenter) => {
        const expansionKey = `${department.key}:${costCenter.key}`;
        const costCenterExpanded = expandedCostCenters.has(expansionKey);
        return (
          <CostCenterRows
            key={expansionKey}
            costCenter={costCenter}
            expanded={costCenterExpanded}
            onToggle={() => onToggleCostCenter(expansionKey)}
          />
        );
      })}
    </>
  );
}

function CostCenterRows({
  costCenter,
  expanded,
  onToggle,
}: {
  costCenter: TonerRequestGroup;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-sky-100 bg-sky-50/35">
        <td className="px-5 py-3 pl-16">
          <button type="button" onClick={onToggle} aria-expanded={expanded} className="group flex w-full items-center gap-2 text-left">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-md border transition ${expanded ? "border-[#4f7fa9] bg-[#4f7fa9] text-white" : "-rotate-90 border-sky-200 bg-white text-[#4f7fa9] group-hover:border-[#4f7fa9]"}`}><IconGlyph icon={ChevronDown} size={12} /></span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-700">{costCenter.name}</span>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500" title={officeLabel(costCenter)}>{officeLabel(costCenter)}</span>
            </span>
          </button>
        </td>
        <td className="px-3 py-3"><TonerPills rows={costCenter.tonerTypes} /></td>
        <NumberCell value={costCenter.requestLines} />
        <NumberCell value={costCenter.units} />
        <td className="px-5 py-3 text-right font-semibold tabular-nums text-slate-700">{currency.format(costCenter.expenseCents / 100)}</td>
      </tr>
      {expanded && costCenter.tonerTypes.map((tonerType) => (
        <tr key={`${costCenter.key}-${tonerType.key}`} className="border-t border-slate-100 bg-white">
          <td className="px-5 py-3 pl-24 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-400">Toner costing</td>
          <td className="px-3 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-slate-700">{tonerType.name}</span>
              <span className="text-[11px] text-slate-500">{formatUnitCost(tonerType)} per unit</span>
            </div>
          </td>
          <NumberCell value={tonerType.requestLines} />
          <NumberCell value={tonerType.units} />
          <td className="px-5 py-3 text-right font-bold tabular-nums text-[#014171]">{currency.format(tonerType.expenseCents / 100)}</td>
        </tr>
      ))}
    </>
  );
}

function TonerPills({ rows }: { rows: TonerRequestGroup[] }) {
  return <div className="flex flex-wrap gap-1.5">{rows.map((row) => <span key={row.key} title={`${row.requestLines} request records · ${currency.format(row.expenseCents / 100)}`} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600"><span className="max-w-32 truncate">{row.name}</span><strong className="text-[#014171]">×{integer.format(row.units)}</strong></span>)}</div>;
}

function SummaryMetric({ label, value, format = "integer", icon, color, description }: { label: string; value: number; format?: "integer" | "currency"; icon: typeof PackageCheck; color: string; description: string }) {
  return <div className="flex min-h-32 flex-col justify-between bg-white p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[0.07em] text-slate-500">{label}</p><span className={`flex size-8 items-center justify-center rounded-lg bg-slate-50 ${color}`}><IconGlyph icon={icon} size={16} /></span></div><div className="mt-4"><p className="text-2xl font-bold tracking-[-0.03em] text-slate-900"><AnimatedNumber value={value} format={format} /></p><p className="mt-1 text-[10px] leading-4 text-slate-500">{description}</p></div></div>;
}

function NumberCell({ value, strong = false }: { value: number; strong?: boolean }) { return <td className={`px-3 py-3.5 text-right tabular-nums ${strong ? "font-bold text-slate-800" : "text-slate-600"}`}>{integer.format(value)}</td>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.06em] text-slate-500">{label}</span>{children}</label>; }

function FilterField({ label, value, onChange, options, includeUnassigned = false }: { label: string; value: string; onChange: (value: string) => void; options: LookupOption[]; includeUnassigned?: boolean }) {
  return <SearchableDropdown label={label} value={value} onValueChange={onChange} placeholder={`Search ${label.toLowerCase()}...`} options={[{ value: "", label: `All ${label.toLowerCase()}` }, ...(includeUnassigned ? [{ value: "unassigned", label: "Unassigned" }] : []), ...options.map((option) => ({ value: String(option.id), label: option.name }))]} inputClassName={fieldClassName} labelClassName="!text-[10px] !font-bold !uppercase !tracking-[0.06em] !text-slate-500" />;
}

function matchesFilters(record: TonerExpenseViewRecord, filters: FilterState) {
  if (!filters.allTime && filters.dateFrom && record.date < filters.dateFrom) return false;
  if (!filters.allTime && filters.dateTo && record.date > filters.dateTo) return false;
  return matchesLookup(filters.department, record.departmentId)
    && matchesLookup(filters.subunit, record.subunitId ?? null)
    && matchesLookup(filters.costCenter, record.costCenterId ?? null)
    && matchesLookup(filters.location, record.locationId)
    && matchesLookup(filters.tonerType, record.tonerTypeId)
    && matchesLookup(filters.itsName, record.itsNameId);
}

function matchesLookup(filter: string, value: number | null) { return !filter || (filter === "unassigned" ? value === null : String(value) === filter); }
function formatUnitCost(row: TonerRequestGroup) { return currency.format(row.units > 0 ? row.expenseCents / row.units / 100 : 0); }
function officeLabel(row: TonerRequestGroup) { return row.officeNames.join(", ") || "Unassigned office"; }
function pluralize(value: number, noun: string) { return value === 1 ? noun : `${noun}s`; }
