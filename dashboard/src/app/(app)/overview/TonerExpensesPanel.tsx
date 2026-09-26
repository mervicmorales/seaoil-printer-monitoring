"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Droplets, ExternalLink } from "lucide";
import { IconGlyph } from "@/components/ui";
import {
  sortExpenseRows,
  yearlyExpenseSeries,
  type OverviewExpenseBreakdown,
  type OverviewExpenseGrain,
  type OverviewExpenseSort,
  type OverviewPeriod,
  type OverviewScope,
} from "@/lib/overview-analytics";
import type { ExpenseBreakdown, TonerExpenseSummary } from "@/lib/toner-expenses";

type ExpenseData = { period: OverviewPeriod; label: string; summary: TonerExpenseSummary };

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 });
const integer = new Intl.NumberFormat("en-PH");
const selectClassName = "h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/10";

export default function TonerExpensesPanel({ initialData, initialScope }: { initialData: ExpenseData; initialScope: OverviewScope }) {
  const [period, setPeriod] = useState(initialScope.period);
  const [grain, setGrain] = useState(initialScope.expenseGrain);
  const [breakdown, setBreakdown] = useState(initialScope.expenseBreakdown);
  const [sort, setSort] = useState(initialScope.expenseSort);
  const [data, setData] = useState(initialData);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  function rememberSelection(name: string, value: string) {
    const url = new URL(window.location.href);
    url.searchParams.set(name, value);
    window.history.replaceState(window.history.state, "", url);
  }

  async function changePeriod(nextPeriod: OverviewPeriod) {
    request.current?.abort();
    rememberSelection("period", nextPeriod);
    setPeriod(nextPeriod);
    setError("");
    if (nextPeriod === data.period) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    try {
      const response = await fetch(`/api/overview/expenses?period=${encodeURIComponent(nextPeriod)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Could not update toner expenses. Please try again.");
      const next = await response.json() as ExpenseData;
      if (!controller.signal.aborted) setData(next);
    } catch {
      if (!controller.signal.aborted) {
        rememberSelection("period", data.period);
        setPeriod(data.period);
        setError("Could not update toner expenses. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  const summary = data.summary;
  const rows = sortExpenseRows(expenseBreakdown(summary, breakdown), sort).slice(0, 8);
  const trend = grain === "yearly" ? yearlyExpenseSeries(summary.months) : summary.months.slice(-12);

  return (
    <section aria-labelledby="expense-heading" aria-busy={loading} className="order-5 flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-8">
      <div className="flex min-h-[4.25rem] flex-col justify-between gap-3 border-t-2 border-t-[#7c3aed] border-b border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2.5"><span className="shrink-0 text-[#014171]"><IconGlyph icon={Droplets} size={16} /></span><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#4f7fa9]">Cost analytics</p><span className="truncate text-[9px] text-slate-400">· {data.label}</span></div><h2 id="expense-heading" className="truncate text-sm font-bold text-slate-800">Toner expenses</h2><p className="truncate text-[10px] text-slate-500">Requested quantity × current configured unit cost</p></div></div>
        <Link href="/toner-expenses" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#0b70a8] hover:text-[#014171]">View details <IconGlyph icon={ExternalLink} size={10} /></Link>
      </div>
      <div className="grid gap-4 border-b border-slate-200 bg-slate-50/60 px-4 py-3 lg:grid-cols-[minmax(10rem,0.7fr)_minmax(0,2fr)] lg:items-end">
        <div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Estimated expense</p><p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#014171]">{money.format(summary.totalExpenseCents / 100)}</p><p className="mt-0.5 text-[10px] text-slate-500">{integer.format(summary.totalUnits)} units · {integer.format(summary.requestLines)} request records</p></div>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <SmallSelect label="Reporting period" value={period} onChange={(value) => void changePeriod(value as OverviewPeriod)} options={[{ value: "30d", label: "Last 30 days" }, { value: "90d", label: "Last 90 days" }, { value: "12m", label: "Last 12 months" }, { value: "ytd", label: "Year to date" }, { value: "all", label: "All activity" }]} />
          <SmallSelect label="Trend" value={grain} onChange={(value) => { rememberSelection("expenseGrain", value); setGrain(value as OverviewExpenseGrain); }} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />
          <SmallSelect label="Rank by" value={breakdown} onChange={(value) => { rememberSelection("expenseBreakdown", value); setBreakdown(value as OverviewExpenseBreakdown); }} options={[{ value: "toner", label: "Toner type" }, { value: "location", label: "Location" }, { value: "department", label: "Department" }]} />
          <SmallSelect label="Order" value={sort} onChange={(value) => { rememberSelection("expenseSort", value); setSort(value as OverviewExpenseSort); }} options={[{ value: "desc", label: "Highest first" }, { value: "asc", label: "Lowest first" }]} />
        </div>
      </div>
      <div aria-live="polite" className="sr-only">{loading ? "Updating toner expenses" : error || ""}</div>
      {error && <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p>}
      <div className="grid flex-1 lg:grid-cols-2">
        <div className="flex flex-col border-b border-slate-200 p-4 lg:border-r lg:border-b-0"><h3 className="text-xs font-bold text-slate-800">{grain === "monthly" ? "Monthly" : "Yearly"} expense trend</h3><p className="mt-0.5 text-[10px] text-slate-500">Amount within the selected reporting period</p><ColumnChart rows={trend} /></div>
        <div className="p-4"><h3 className="text-xs font-bold text-slate-800">Expense by {breakdownLabel(breakdown).toLowerCase()}</h3><p className="mt-0.5 text-[10px] text-slate-500">{sort === "asc" ? "Lowest to highest" : "Highest to lowest"} estimated amount</p><div className="mt-4 space-y-3">{rows.length ? rows.map((row, index) => <RankBar key={row.key} rank={index + 1} label={row.name} value={row.expenseCents} max={Math.max(...rows.map((item) => item.expenseCents), 1)} formatted={money.format(row.expenseCents / 100)} />) : <EmptyMessage>No expense records match this scope.</EmptyMessage>}</div></div>
      </div>
    </section>
  );
}

function SmallSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }) {
  return <label className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.07em] text-slate-500">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className={selectClassName}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}

function EmptyMessage({ children }: { children: React.ReactNode }) { return <div className="flex min-h-24 items-center justify-center border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-xs leading-5 text-slate-500">{children}</div>; }
function percentage(value: number, total: number) { return total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0; }
function expenseBreakdown(summary: TonerExpenseSummary, dimension: OverviewExpenseBreakdown): ExpenseBreakdown[] { return dimension === "location" ? summary.locations : dimension === "department" ? summary.departments : summary.tonerTypes; }
function breakdownLabel(dimension: OverviewExpenseBreakdown) { return dimension === "toner" ? "Toner type" : dimension[0].toUpperCase() + dimension.slice(1); }
function chartLabel(key: string) { if (/^\d{4}$/.test(key)) return key; const parts = key.split("-").map(Number); const date = new Date(Date.UTC(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1)); return new Intl.DateTimeFormat("en-PH", parts.length === 3 ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", year: "2-digit", timeZone: "UTC" }).format(date); }

function RankBar({ rank, label, value, max, formatted }: { rank: number; label: string; value: number; max: number; formatted: string }) {
  return <div><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">{rank}</span><p className="truncate text-xs font-bold text-slate-700" title={label}>{label}</p></div><p className="shrink-0 text-xs font-bold tabular-nums text-[#014171]">{formatted}</p></div><div className="mt-2 ml-7 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#7c3aed]" style={{ width: `${percentage(value, max)}%` }} /></div></div>;
}

function ColumnChart({ rows }: { rows: ExpenseBreakdown[] }) {
  const displayed = rows.slice(-12);
  const max = Math.max(...displayed.map((row) => row.expenseCents), 1);
  const peak = displayed.reduce<ExpenseBreakdown | null>((current, row) => !current || row.expenseCents > current.expenseCents ? row : current, null);
  if (!displayed.length) return <div className="mt-5"><EmptyMessage>No expense trend is available for this period.</EmptyMessage></div>;
  return <div className="mt-6 flex flex-col"><div className="flex h-64 items-end gap-2 border-b border-slate-200 px-1">{displayed.map((row) => <div key={row.key} className="group relative flex h-full min-w-0 flex-1 items-end"><div title={`${chartLabel(row.key)}: ${money.format(row.expenseCents / 100)}`} className="w-full rounded-t-md bg-[#0b70a8] transition hover:bg-[#014171]" style={{ height: `${Math.max(4, percentage(row.expenseCents, max))}%` }} /></div>)}</div><div className="mt-2 flex gap-2 px-1">{displayed.map((row, index) => <span key={row.key} className="min-w-0 flex-1 truncate text-center text-[9px] font-semibold text-slate-400">{index % Math.ceil(displayed.length / 6) === 0 || index === displayed.length - 1 ? chartLabel(row.key) : ""}</span>)}</div><div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>Peak · {peak ? chartLabel(peak.key) : "—"}</span><strong className="text-slate-700">{money.format(max / 100)}</strong></div></div>;
}
