"use client";

/*
 * The dithered trend treatment is adapted from Amicro's Dither Charts by
 * Syed Subhan Uddin. The original work is MIT licensed. See
 * THIRD_PARTY_NOTICES.md.
 */

import { useMemo, useState } from "react";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import type { TonerExpenseViewRecord } from "@/lib/toner-expense-groups";

type TrendPeriod = "week" | "month" | "quarter" | "year";
type ExpensePoint = {
  key: string;
  label: string;
  fullLabel: string;
  deliveryCents: number;
  requestCents: number;
};

type ExpenseBucket = ExpensePoint & {
  start: string;
  end: string;
};

type CostCenterRow = {
  key: string;
  name: string;
  units: number;
  expenseCents: number;
  share: number;
};

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});
const integer = new Intl.NumberFormat("en-PH");
const periods: { value: TrendPeriod; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

export function ExpenseFlowVisual({
  requests,
  deliveries,
}: {
  requests: readonly TonerExpenseViewRecord[];
  deliveries: readonly TonerExpenseViewRecord[];
}) {
  const [period, setPeriod] = useState<TrendPeriod>("month");
  const points = useMemo(() => buildExpensePoints(requests, deliveries, period), [deliveries, period, requests]);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const activePoint = points.find((point) => point.key === hoveredKey) ?? points.at(-1) ?? null;
  const maximum = Math.max(1, ...points.flatMap((point) => [point.deliveryCents, point.requestCents]));
  const hasValue = points.some((point) => point.deliveryCents > 0 || point.requestCents > 0);
  const width = 760;
  const height = 238;
  const plot = { left: 22, right: 14, top: 18, bottom: 36 };
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const x = (index: number) => plot.left + (points.length === 1 ? plotWidth / 2 : (index / Math.max(1, points.length - 1)) * plotWidth);
  const y = (value: number) => plot.top + plotHeight - (value / maximum) * plotHeight;
  const requestPath = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(point.requestCents).toFixed(1)}`).join(" ");
  const barWidth = Math.max(8, Math.min(28, plotWidth / Math.max(1, points.length) * 0.46));

  return (
    <section aria-labelledby="expense-flow-heading" className="flex flex-col overflow-hidden rounded-lg border border-slate-200 bg-white xl:h-[30rem]">
      <div className="flex shrink-0 flex-col gap-3 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div>
          <h2 id="expense-flow-heading" className="text-base font-bold text-[#014171]">Purchase vs. Request Cost</h2>
          <p className="mt-1 text-xs text-slate-500">Estimated delivery value compared with estimated request cost.</p>
        </div>
        <div role="group" aria-label="Expense trend period" className="flex w-fit shrink-0 items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
          {periods.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              onClick={() => {
                setPeriod(option.value);
                setHoveredKey(null);
              }}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${period === option.value ? "bg-[#014171] text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-800"}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {hasValue && activePoint ? (
        <div className="min-h-0 flex-1 p-4 sm:p-5">
          <div className="mb-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-bold text-slate-700">{activePoint.fullLabel}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500">
              <span><i className="mr-1.5 inline-block size-2 rounded-sm bg-emerald-500 align-middle" />Purchased <strong className="ml-1 tabular-nums text-emerald-700">{money.format(activePoint.deliveryCents / 100)}</strong></span>
              <span><i className="mr-1.5 inline-block size-2 rounded-full bg-[#014171] align-middle" />Requested <strong className="ml-1 tabular-nums text-[#014171]">{money.format(activePoint.requestCents / 100)}</strong></span>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-lg border border-slate-100 bg-slate-50/35">
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Estimated toner delivery and request costs over time" className="block h-auto min-h-56 w-full xl:h-60 xl:min-h-0">
              <defs>
                <pattern id="expense-delivery-dither" width="6" height="6" patternUnits="userSpaceOnUse">
                  <rect width="6" height="6" fill="#ecfdf5" />
                  <rect width="2.2" height="2.2" x="0.7" y="0.7" rx="0.4" fill="#10b981" />
                  <rect width="1.4" height="1.4" x="4" y="4" rx="0.3" fill="#059669" />
                </pattern>
              </defs>

              {[0, 0.5, 1].map((ratio) => {
                const gridY = plot.top + plotHeight * ratio;
                return <line key={ratio} x1={plot.left} x2={width - plot.right} y1={gridY} y2={gridY} stroke="#cbd5e1" strokeDasharray="3 5" strokeWidth="1" opacity="0.6" />;
              })}

              {points.map((point, index) => {
                const pointX = x(index);
                const deliveryY = y(point.deliveryCents);
                const active = point.key === activePoint.key;
                return (
                  <g
                    key={point.key}
                    tabIndex={0}
                    aria-label={`${point.fullLabel}: delivered ${money.format(point.deliveryCents / 100)}, requested ${money.format(point.requestCents / 100)}`}
                    onMouseEnter={() => setHoveredKey(point.key)}
                    onFocus={() => setHoveredKey(point.key)}
                    className="outline-none"
                  >
                    <rect x={pointX - Math.max(18, plotWidth / points.length / 2)} y={plot.top} width={Math.max(36, plotWidth / points.length)} height={plotHeight} fill="transparent" />
                    {active && <line x1={pointX} x2={pointX} y1={plot.top} y2={plot.top + plotHeight} stroke="#014171" strokeDasharray="3 4" opacity="0.32" />}
                    <rect
                      x={pointX - barWidth / 2}
                      y={deliveryY}
                      width={barWidth}
                      height={Math.max(1, plot.top + plotHeight - deliveryY)}
                      rx="3"
                      fill="url(#expense-delivery-dither)"
                      stroke={active ? "#047857" : "#6ee7b7"}
                      strokeWidth={active ? "1.6" : "1"}
                      className="transition-opacity"
                    />
                    <text x={pointX} y={height - 12} textAnchor="middle" fill="#64748b" fontSize="9" fontWeight="600">{point.label}</text>
                  </g>
                );
              })}

              <path d={requestPath} fill="none" stroke="#014171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              {points.map((point, index) => (
                <circle key={`request-${point.key}`} cx={x(index)} cy={y(point.requestCents)} r={point.key === activePoint.key ? 4.4 : 3.1} fill="#014171" stroke="white" strokeWidth="1.8" />
              ))}
            </svg>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-slate-500">Purchase value is an estimate based on each toner type&apos;s current configured unit cost, not the historical amount paid.</p>
        </div>
      ) : (
        <EmptyVisual>No priced delivery or request activity is available for this period.</EmptyVisual>
      )}
    </section>
  );
}

export function CostCenterVisual({ requests }: { requests: readonly TonerExpenseViewRecord[] }) {
  const rows = useMemo(() => buildCostCenterRows(requests), [requests]);
  const maximum = Math.max(1, ...rows.map((row) => row.expenseCents));

  return (
    <section aria-labelledby="cost-center-heading" className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white xl:h-[30rem]">
      <div className="shrink-0 border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 id="cost-center-heading" className="text-base font-bold text-[#014171]">Cost by Cost Center</h2>
        <p className="mt-1 text-xs text-slate-500">Ranked by estimated toner request expense in the current filtered view.</p>
      </div>

      {rows.length ? (
        <div
          aria-label="Cost centers ranked by estimated expense"
          tabIndex={0}
          className="min-h-0 max-h-[23rem] flex-1 space-y-2.5 overflow-y-auto overscroll-contain p-4 pr-2 [scrollbar-gutter:stable] sm:p-5 sm:pr-3 xl:max-h-none"
        >
          {rows.map((row, index) => (
            <div key={row.key} tabIndex={0} className="group rounded-lg border border-transparent px-2 py-2 outline-none transition hover:border-slate-200 hover:bg-slate-50 focus-visible:border-[#014171] focus-visible:bg-sky-50/50">
              <div className="mb-1.5 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <span className="mt-0.5 w-4 shrink-0 text-[10px] font-bold tabular-nums text-slate-400">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-slate-700">{row.name}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">{integer.format(row.units)} units · {row.share}% of expense</p>
                  </div>
                </div>
                <p className="shrink-0 text-xs font-bold tabular-nums text-[#014171]"><AnimatedNumber value={row.expenseCents / 100} format="currency" duration={500 + index * 45} /></p>
              </div>
              <div className="ml-6 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#014171] to-[#0b70a8] transition-[width,filter] duration-700 group-hover:brightness-110"
                  style={{ width: `${Math.max(2, (row.expenseCents / maximum) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyVisual>No priced cost-center requests match the selected filters.</EmptyVisual>
      )}
    </section>
  );
}

function buildExpensePoints(
  requests: readonly TonerExpenseViewRecord[],
  deliveries: readonly TonerExpenseViewRecord[],
  period: TrendPeriod,
) {
  const anchor = latestDate([...requests, ...deliveries]);
  const buckets = createBuckets(period, anchor);
  addRecordsToBuckets(buckets, requests, "requestCents");
  addRecordsToBuckets(buckets, deliveries, "deliveryCents");
  return buckets;
}

function createBuckets(period: TrendPeriod, anchorDate: string): ExpenseBucket[] {
  const anchor = parseDate(anchorDate);
  if (period === "year") {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 11, 1));
    return Array.from({ length: 12 }, (_, index) => {
      const bucketStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
      const bucketEnd = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index + 1, 0));
      return bucket(formatDate(bucketStart), formatDate(bucketEnd), shortMonth(bucketStart), longMonth(bucketStart));
    });
  }

  const specs = period === "week"
    ? { count: 7, days: 1 }
    : period === "month"
      ? { count: 6, days: 5 }
      : { count: 13, days: 7 };
  const totalDays = specs.count * specs.days;
  const start = addDays(anchor, -(totalDays - 1));
  return Array.from({ length: specs.count }, (_, index) => {
    const bucketStart = addDays(start, index * specs.days);
    const bucketEnd = index === specs.count - 1 ? anchor : addDays(bucketStart, specs.days - 1);
    const shortLabel = period === "week" ? shortDate(bucketStart) : shortDate(bucketEnd);
    const fullLabel = specs.days === 1 ? longDate(bucketStart) : `${shortDate(bucketStart)} – ${shortDate(bucketEnd)}`;
    return bucket(formatDate(bucketStart), formatDate(bucketEnd), shortLabel, fullLabel);
  });
}

function bucket(start: string, end: string, label: string, fullLabel: string): ExpenseBucket {
  return { key: start, start, end, label, fullLabel, deliveryCents: 0, requestCents: 0 };
}

function addRecordsToBuckets(
  buckets: ExpenseBucket[],
  records: readonly TonerExpenseViewRecord[],
  field: "deliveryCents" | "requestCents",
) {
  records.forEach((record) => {
    const target = buckets.find((item) => record.date >= item.start && record.date <= item.end);
    if (target) target[field] += Math.max(0, record.quantity) * Math.max(0, record.unitCostCents);
  });
}

function buildCostCenterRows(requests: readonly TonerExpenseViewRecord[]): CostCenterRow[] {
  const grouped = new Map<string, Omit<CostCenterRow, "share">>();
  requests.forEach((record) => {
    const key = record.costCenterId == null ? "unassigned" : String(record.costCenterId);
    const current = grouped.get(key) ?? {
      key,
      name: record.costCenterCode?.trim() || "Unassigned cost center",
      units: 0,
      expenseCents: 0,
    };
    current.units += Math.max(0, record.quantity);
    current.expenseCents += Math.max(0, record.quantity) * Math.max(0, record.unitCostCents);
    grouped.set(key, current);
  });

  const sorted = [...grouped.values()]
    .filter((row) => row.expenseCents > 0)
    .sort((left, right) => right.expenseCents - left.expenseCents || right.units - left.units || left.name.localeCompare(right.name));
  const total = sorted.reduce((sum, row) => sum + row.expenseCents, 0);
  const visible = sorted.slice(0, 8);
  if (sorted.length > 8) {
    visible.push(sorted.slice(8).reduce((row, item) => ({
      ...row,
      units: row.units + item.units,
      expenseCents: row.expenseCents + item.expenseCents,
    }), { key: "other", name: "Other cost centers", units: 0, expenseCents: 0 }));
  }
  return visible.map((row) => ({ ...row, share: total ? Math.round((row.expenseCents / total) * 100) : 0 }));
}

function latestDate(records: readonly TonerExpenseViewRecord[]) {
  if (!records.length) return manilaToday();
  return records.reduce((latest, record) => record.date > latest ? record.date : latest, records[0]!.date);
}

function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date());
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
}

function formatDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function shortDate(date: Date) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" }).format(date);
}

function longDate(date: Date) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function shortMonth(date: Date) {
  return new Intl.DateTimeFormat("en-PH", { month: "short", timeZone: "UTC" }).format(date);
}

function longMonth(date: Date) {
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

function EmptyVisual({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-60 items-center justify-center px-5 text-center text-xs leading-5 text-slate-500">{children}</div>;
}
