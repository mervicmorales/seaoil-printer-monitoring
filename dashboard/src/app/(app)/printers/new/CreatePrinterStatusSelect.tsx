"use client";

import { useState } from "react";
import { PRINTER_STATUSES } from "@/lib/constants";
import { statusBadgeColor } from "@/components/ui";

const STATUS_COLORS = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-700 focus:border-emerald-500 focus:ring-emerald-200",
  yellow: "border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-500 focus:ring-amber-200",
  red: "border-red-300 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-200",
  blue: "border-sky-300 bg-sky-50 text-sky-700 focus:border-sky-500 focus:ring-sky-200",
  gray: "border-slate-300 bg-slate-50 text-slate-700 focus:border-slate-500 focus:ring-slate-200",
  orange: "border-orange-300 bg-orange-50 text-orange-700 focus:border-orange-500 focus:ring-orange-200",
} as const;

export default function CreatePrinterStatusSelect({
  formId,
  compact = false,
}: {
  formId: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState("Active");
  const statusColor = STATUS_COLORS[statusBadgeColor(status)];

  if (compact) {
    return (
      <div className={`flex h-8 shrink-0 items-center overflow-hidden rounded-lg border shadow-sm transition focus-within:ring-2 ${statusColor}`}>
        <label
          htmlFor="new-printer-status"
          className="flex h-full items-center border-r border-current/15 px-2 text-[9px] font-bold uppercase tracking-[0.09em] opacity-75"
        >
          Asset status
        </label>
        <select
          id="new-printer-status"
          name="status"
          form={formId}
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          required
          className="h-full min-w-28 bg-transparent px-2.5 text-xs font-bold outline-none"
        >
          {PRINTER_STATUSES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="new-printer-status" className="text-xs font-medium text-slate-600">
        Asset Status
      </label>
      <select
        id="new-printer-status"
        name="status"
        form={formId}
        value={status}
        onChange={(event) => setStatus(event.target.value)}
        required
        className={`min-w-48 rounded-lg border px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:ring-2 ${statusColor}`}
      >
        {PRINTER_STATUSES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </div>
  );
}
