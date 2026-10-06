"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Droplets, ExternalLink } from "lucide";
import { IconGlyph } from "@/components/ui";
import {
  sortExpenseRows,
  type OverviewExpenseBreakdown,
  type OverviewExpenseSort,
  type OverviewPeriod,
  type OverviewScope,
} from "@/lib/overview-analytics";
import type { ExpenseBreakdown, TonerExpenseSummary } from "@/lib/toner-expenses";
import SearchableDropdown from "@/components/SearchableDropdown";
import DitherDonutChart from "@/components/ui/DitherDonutChart";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import {
  overviewTonerPeriods,
  useOverviewTonerAnalytics,
  type OverviewTonerPeriod,
} from "./OverviewTonerAnalyticsContext";

type ExpenseData = { period: OverviewPeriod; label: string; summary: TonerExpenseSummary };

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 });
const integer = new Intl.NumberFormat("en-PH");
const selectClassName = "h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/10";

export default function TonerExpensesPanel({ initialData, initialScope }: { initialData: ExpenseData; initialScope: OverviewScope }) {
  const { period, setPeriod, setHighlightedExpenseScope } = useOverviewTonerAnalytics();
  const [breakdown, setBreakdown] = useState(initialScope.expenseBreakdown);
  const [sort, setSort] = useState(initialScope.expenseSort);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState<{ period: OverviewTonerPeriod; message: string } | null>(null);
  const request = useRef<AbortController | null>(null);
  const loading = period !== data.period;
  const visibleError = error?.period === period ? error.message : "";

  function rememberSelection(name: string, value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    window.history.replaceState(window.history.state, "", url);
  }

  useEffect(() => {
    request.current?.abort();
    if (period === data.period) return undefined;
    const controller = new AbortController();
    request.current = controller;
    void (async () => {
      try {
        const response = await fetch(`/api/overview/expenses?period=${encodeURIComponent(period)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Could not update toner expenses. Please try again.");
        const next = await response.json() as ExpenseData;
        if (!controller.signal.aborted) {
          setData(next);
          setError(null);
        }
      } catch {
        if (!controller.signal.aborted) {
          const fallbackPeriod = toOverviewTonerPeriod(data.period);
          setError({ period: fallbackPeriod, message: "Could not update toner expenses. Please try again." });
          setPeriod(fallbackPeriod);
        }
      }
    })();
    return () => controller.abort();
  }, [data.period, period, setPeriod]);

  useEffect(() => () => setHighlightedExpenseScope(null), [setHighlightedExpenseScope]);

  const handleActiveExpense = useCallback((item: { key: string; label: string } | null) => {
    if (item) {
      setHighlightedExpenseScope({
        dimension: breakdown === "department" ? "department" : breakdown === "location" ? "office" : "toner",
        key: item.key,
        label: item.label,
      });
    } else {
      setHighlightedExpenseScope(null);
    }
  }, [breakdown, setHighlightedExpenseScope]);

  const summary = data.summary;
  const rows = sortExpenseRows(expenseBreakdown(summary, breakdown), sort).slice(0, 8);

  return (
    <section aria-labelledby="expense-heading" aria-busy={loading} className="order-5 flex h-fit self-start flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-8">
      <div className="flex min-h-[4.25rem] flex-col justify-between gap-3 border-t-2 border-t-[#7c3aed] border-b border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2.5"><span className="shrink-0 text-[#014171]"><IconGlyph icon={Droplets} size={16} /></span><div className="min-w-0"><div className="flex items-center gap-2"><h2 id="expense-heading" className="truncate text-sm font-bold text-slate-800">Toner Costs</h2><span className="truncate text-[9px] text-slate-400">· {data.label}</span></div><p className="truncate text-[10px] text-slate-500">Requested quantity × current configured unit cost</p></div></div>
        <Link href="/toner-expenses" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#0b70a8] hover:text-[#014171]">View details <IconGlyph icon={ExternalLink} size={10} /></Link>
      </div>
      <div className="grid gap-4 border-b border-slate-200 bg-slate-50/60 px-4 py-3 lg:grid-cols-[minmax(10rem,0.7fr)_minmax(0,2fr)] lg:items-end">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Estimated expense</p><p className="mt-1 text-3xl font-bold tracking-[-0.03em] text-[#014171]"><AnimatedNumber value={summary.totalExpenseCents / 100} format="currency" /></p><p className="mt-1 text-xs text-slate-500">{integer.format(summary.totalUnits)} units · {integer.format(summary.requestLines)} request records</p></div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <SmallSelect label="Rank by" value={breakdown} onChange={(value) => { rememberSelection("expenseBreakdown", value); setBreakdown(value as OverviewExpenseBreakdown); setHighlightedExpenseScope(null); }} options={[{ value: "toner", label: "Toner type" }, { value: "location", label: "Office" }, { value: "department", label: "Department" }]} />
          <SmallSelect label="Order" value={sort} onChange={(value) => { rememberSelection("expenseSort", value); setSort(value as OverviewExpenseSort); }} options={[{ value: "desc", label: "Highest first" }, { value: "asc", label: "Lowest first" }]} />
        </div>
      </div>
      <div aria-live="polite" className="sr-only">{loading ? "Updating toner expenses" : visibleError}</div>
      {visibleError && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{visibleError}</p>}
      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-slate-800">Expense by {breakdownLabel(breakdown).toLowerCase()}</h3>
            <p className="mt-0.5 text-xs text-slate-500">{sort === "asc" ? "Lowest to highest" : "Highest to lowest"} estimated amount</p>
          </div>
          <ExpensePeriodTabs value={period} onChange={setPeriod} disabled={loading} />
        </div>
        {rows.length && rows.some((row) => row.expenseCents > 0)
          ? <DitherDonutChart data={rows.map((row) => ({ key: row.key, label: row.name, value: row.expenseCents }))} formatValue={(value) => money.format(value / 100)} onActiveDatumChange={handleActiveExpense} />
          : <div className="mt-4"><EmptyMessage>No priced expense records match this scope.</EmptyMessage></div>}
      </div>
    </section>
  );
}

function SmallSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <SearchableDropdown label={label} value={value} onValueChange={onChange} options={options} placeholder={`Search ${label.toLowerCase()}...`} inputClassName={selectClassName} labelClassName="!mb-1 !text-[10px] !font-bold !uppercase !tracking-[0.07em] !text-slate-500" />;
}

function EmptyMessage({ children }: { children: React.ReactNode }) { return <div className="flex min-h-24 items-center justify-center border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-xs leading-5 text-slate-500">{children}</div>; }
function expenseBreakdown(summary: TonerExpenseSummary, dimension: OverviewExpenseBreakdown): ExpenseBreakdown[] { return dimension === "location" ? summary.locations : dimension === "department" ? summary.departments : summary.tonerTypes; }
function breakdownLabel(dimension: OverviewExpenseBreakdown) { return dimension === "toner" ? "Toner type" : dimension[0].toUpperCase() + dimension.slice(1); }

const expensePeriodLabels: Record<OverviewTonerPeriod, string> = {
  "7d": "Week",
  "30d": "Month",
  "90d": "Quarter",
  "12m": "Year",
};

const expensePeriodOptions = overviewTonerPeriods.map((value) => ({ value, label: expensePeriodLabels[value] }));

function ExpensePeriodTabs({ value, onChange, disabled }: { value: OverviewTonerPeriod; onChange: (value: OverviewTonerPeriod) => void; disabled: boolean }) {
  return (
    <div role="group" aria-label="Expense reporting period" className="flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
      {expensePeriodOptions.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition disabled:cursor-wait disabled:opacity-60 ${active ? "bg-[#1267f2] text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function toOverviewTonerPeriod(period: OverviewPeriod): OverviewTonerPeriod {
  return overviewTonerPeriods.includes(period as OverviewTonerPeriod) ? period as OverviewTonerPeriod : "30d";
}
