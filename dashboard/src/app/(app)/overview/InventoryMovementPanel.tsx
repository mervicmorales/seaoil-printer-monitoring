"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BarChart3, ExternalLink } from "lucide";
import { IconGlyph } from "@/components/ui";
import DitherInventoryGrowthChart from "@/components/ui/DitherInventoryGrowthChart";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import {
  buildInventoryWaterfall,
  type InventoryMovementPeriod,
  type InventoryMovementRecord,
} from "@/lib/inventory-waterfall";

const periodOptions: Array<{ value: InventoryMovementPeriod; label: string }> = [
  { value: "7d", label: "Week" },
  { value: "30d", label: "Month" },
  { value: "90d", label: "Quarter" },
];

export default function InventoryMovementPanel({
  currentStock,
  today,
  movements,
}: {
  currentStock: number;
  today: string;
  movements: InventoryMovementRecord[];
}) {
  const [period, setPeriod] = useState<InventoryMovementPeriod>("30d");
  const waterfall = useMemo(
    () => buildInventoryWaterfall(currentStock, today, period, movements),
    [currentStock, movements, period, today],
  );
  const chartPoints = useMemo(() => waterfall.steps.map((step) => ({
    key: step.key,
    label: step.label,
    balance: step.end,
    delivered: step.deliveries,
    requested: step.requests,
  })), [waterfall.steps]);

  return (
    <section aria-labelledby="inventory-movement-heading" className="@container flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="relative grid min-h-[6.5rem] grid-cols-1 grid-rows-[auto_auto] gap-x-3 gap-y-2 border-t-2 border-t-[#7c3aed] border-b border-slate-200 px-4 py-2.5 @min-[28rem]:min-h-[5.25rem] @min-[28rem]:grid-cols-[minmax(0,1fr)_auto] @min-[28rem]:grid-rows-2 @min-[28rem]:gap-y-1">
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5 self-start pr-20 @min-[28rem]:row-span-2 @min-[28rem]:self-center">
          <span className="shrink-0 text-[#014171]"><IconGlyph icon={BarChart3} size={16} /></span>
          <div className="min-w-0">
            <p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#4f7fa9]">Inventory analytics</p>
            <h2 id="inventory-movement-heading" className="truncate text-sm font-bold text-slate-800">Inventory movement</h2>
            <p className="truncate text-[10px] text-slate-500">How deliveries and requests changed total stock</p>
          </div>
        </div>
        <Link href="/toner-monitoring" className="absolute right-4 top-2.5 inline-flex items-center gap-1 whitespace-nowrap text-[10px] font-bold text-[#0b70a8] hover:text-[#014171]">View details <IconGlyph icon={ExternalLink} size={10} /></Link>
        <div className="col-start-1 row-start-2 shrink-0 self-end justify-self-end @min-[28rem]:col-start-2">
          <PeriodTabs value={period} onChange={setPeriod} />
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 bg-slate-50/60 @min-[28rem]:grid-cols-4 @min-[28rem]:divide-y-0">
        <MovementMetric label="Starting stock" value={waterfall.startingStock} color="text-slate-700" />
        <MovementMetric label="Delivered" value={waterfall.delivered} prefix="+" color="text-emerald-700" />
        <MovementMetric label="Requested" value={waterfall.requested} prefix="−" color="text-rose-700" />
        <MovementMetric label="Ending stock" value={waterfall.endingStock} color="text-[#014171]" />
      </div>

      <DitherInventoryGrowthChart points={chartPoints} />
    </section>
  );
}

function PeriodTabs({ value, onChange }: { value: InventoryMovementPeriod; onChange: (value: InventoryMovementPeriod) => void }) {
  return (
    <div role="group" aria-label="Inventory movement period" className="flex items-center rounded-full border border-slate-200 bg-slate-50 p-1 shadow-sm">
      {periodOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`rounded-full px-2.5 py-1 text-[9px] font-bold transition ${value === option.value ? "bg-[#014171] text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-[#014171]"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function MovementMetric({ label, value, prefix = "", color }: { label: string; value: number; prefix?: string; color: string }) {
  return (
    <div className="px-4 py-2">
      <p className="text-[8px] font-bold uppercase tracking-[0.06em] text-slate-500">{label}</p>
      <p className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}><AnimatedNumber value={value} prefix={prefix} /></p>
    </div>
  );
}
