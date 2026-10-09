"use client";

import { useState } from "react";
import { Package, Ticket, Wrench, type IconNode } from "lucide";
import { IconGlyph } from "@/components/ui";
import AnimatedNumber from "@/components/ui/AnimatedNumber";

type HighlightedMetric = "underRepair" | "spare" | "openTickets";
type DonutSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

const integer = new Intl.NumberFormat("en-PH");

export default function FleetHealthVisual({
  total,
  operational,
  underRepair,
  spare,
  openTickets,
}: {
  total: number;
  operational: number;
  underRepair: number;
  spare: number;
  openTickets: number;
}) {
  const [highlighted, setHighlighted] = useState<HighlightedMetric | null>(null);
  const rate = percentage(operational, total);
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const lifecycleTotal = Math.max(total, operational + underRepair + spare, 1);
  const unclassified = Math.max(0, lifecycleTotal - operational - underRepair - spare);
  const lifecycleSegments: DonutSegment[] = [
    { key: "operational", label: "Operational", value: operational, color: "#10b981" },
    { key: "underRepair", label: "Under repair", value: underRepair, color: "#d97706" },
    { key: "spare", label: "Spare units", value: spare, color: "#4f7fa9" },
    ...(unclassified > 0 ? [{ key: "unclassified", label: "Other status", value: unclassified, color: "#cbd5e1" }] : []),
  ];
  const ticketChartTotal = Math.max(total, openTickets, 1);
  const ticketSegments: DonutSegment[] = [
    { key: "openTickets", label: "Open tickets", value: openTickets, color: "#e11d48" },
    { key: "remaining", label: "Printers without an open ticket", value: Math.max(0, ticketChartTotal - openTickets), color: "#e2e8f0" },
  ];
  const segments = highlighted === "openTickets" ? ticketSegments : lifecycleSegments;
  const chartTotal = highlighted === "openTickets" ? ticketChartTotal : lifecycleTotal;
  const selectedValue = highlighted === "underRepair" ? underRepair : highlighted === "spare" ? spare : highlighted === "openTickets" ? openTickets : rate;
  const selectedLabel = highlighted === "underRepair" ? "Under repair" : highlighted === "spare" ? "Spare units" : highlighted === "openTickets" ? "Open tickets" : "Ready";
  const chartLabel = highlighted === "openTickets"
    ? `${openTickets} open tickets across ${total} printers`
    : `${operational} operational, ${underRepair} under repair, and ${spare} spare printers`;
  const details: Array<{
    key: HighlightedMetric;
    label: string;
    value: number;
    icon: IconNode;
    color: string;
    surface: string;
    active: string;
  }> = [
    { key: "underRepair", label: "Under repair", value: underRepair, icon: Wrench, color: "text-amber-700", surface: "bg-amber-50", active: "bg-amber-50/60 shadow-[inset_0_0_0_1px_#fcd34d]" },
    { key: "spare", label: "Spare units", value: spare, icon: Package, color: "text-[#4f7fa9]", surface: "bg-sky-50", active: "bg-sky-50/70 shadow-[inset_0_0_0_1px_#7dd3fc]" },
    { key: "openTickets", label: "Open tickets", value: openTickets, icon: Ticket, color: "text-rose-700", surface: "bg-rose-50", active: "bg-rose-50/70 shadow-[inset_0_0_0_1px_#fda4af]" },
  ];

  let offset = 0;

  return (
    <div className="grid flex-1 grid-cols-1 items-stretch gap-2 px-2 py-2.5 @min-[24rem]:grid-cols-[minmax(10.5rem,0.95fr)_minmax(0,1.65fr)] @min-[32rem]:gap-3 @min-[32rem]:px-4">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 @min-[32rem]:gap-2.5 @min-[32rem]:px-3">
        <div className="relative size-[clamp(3.75rem,11cqi,4.5rem)] shrink-0" role="img" aria-label={chartLabel}>
          <svg viewBox="0 0 88 88" aria-hidden="true" className="size-full -rotate-90 overflow-visible">
            <circle cx="44" cy="44" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="9" />
            {segments.filter((segment) => segment.value > 0).map((segment) => {
              const length = (segment.value / chartTotal) * circumference;
              const dashOffset = -offset;
              const isHighlightedLifecycleSegment = highlighted === "underRepair" || highlighted === "spare";
              const dimmed = isHighlightedLifecycleSegment && segment.key !== highlighted;
              offset += length;

              return (
                <circle
                  key={segment.key}
                  cx="44"
                  cy="44"
                  r={radius}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={segment.key === highlighted ? 11 : 9}
                  strokeDasharray={`${length} ${Math.max(0, circumference - length)}`}
                  strokeDashoffset={dashOffset}
                  opacity={dimmed ? 0.2 : 1}
                  className="transition-all duration-200 motion-reduce:transition-none"
                />
              );
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className={`text-[clamp(0.875rem,2.7cqi,1.0625rem)] font-bold tabular-nums ${highlighted === "underRepair" ? "text-amber-700" : highlighted === "spare" ? "text-[#4f7fa9]" : highlighted === "openTickets" ? "text-rose-700" : "text-emerald-700"}`}>
              <span className={highlighted ? "hidden" : "inline"}><AnimatedNumber value={rate} format="percent" /></span>
              {highlighted ? integer.format(selectedValue) : null}
            </span>
            <span className="max-w-12 text-[clamp(0.5625rem,1.65cqi,0.6875rem)] font-bold uppercase leading-[1.05] tracking-[0.02em] text-slate-500">{selectedLabel}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="flex items-baseline gap-1 whitespace-nowrap text-[clamp(1.125rem,3.5cqi,1.5rem)] font-bold tabular-nums text-[#014171]">
            <AnimatedNumber value={operational} />
            <span className="text-[clamp(0.625rem,1.8cqi,0.875rem)] font-semibold text-slate-400">of {integer.format(total)}</span>
          </p>
          <p className="mt-0.5 max-w-full text-[clamp(0.625rem,1.75cqi,0.75rem)] font-bold uppercase leading-[1.05] tracking-[0.015em] text-slate-500">Operational printers</p>
        </div>
      </div>
      <div className="grid min-w-0 grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/70">
        {details.map((item) => {
          const isActive = highlighted === item.key;

          return (
            <button
              key={item.key}
              type="button"
              aria-pressed={isActive}
              aria-label={`Show ${item.label.toLowerCase()} in the donut chart`}
              onMouseEnter={() => setHighlighted(item.key)}
              onMouseLeave={() => setHighlighted(null)}
              onFocus={() => setHighlighted(item.key)}
              onBlur={() => setHighlighted(null)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 px-1 py-2 text-center transition-colors duration-150 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#014171] @min-[32rem]:px-1.5 ${isActive ? item.active : "hover:bg-white/80"}`}
            >
              <span className="flex flex-col items-center gap-0.5 @min-[32rem]:flex-row @min-[32rem]:gap-[clamp(0.25rem,1cqi,0.5rem)]">
                <span className={`flex size-[clamp(1.5rem,4.5cqi,1.75rem)] shrink-0 items-center justify-center rounded-md ${item.surface} ${item.color}`}><IconGlyph icon={item.icon} size={13} /></span>
                <span className={`text-[clamp(1rem,3cqi,1.125rem)] font-bold tabular-nums ${item.color}`}><AnimatedNumber value={item.value} /></span>
              </span>
              <span className="max-w-full text-[clamp(0.6rem,1.65cqi,0.75rem)] font-bold uppercase leading-[1.05] tracking-[0.015em] text-slate-500">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function percentage(value: number, total: number) {
  return total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0;
}
