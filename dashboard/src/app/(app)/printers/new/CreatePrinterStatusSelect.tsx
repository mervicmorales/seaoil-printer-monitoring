"use client";

import { useState } from "react";
import { PRINTER_STATUSES } from "@/lib/constants";
import { statusBadgeColor } from "@/components/ui";
import SearchableDropdown from "@/components/SearchableDropdown";

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
      <div className={`flex h-10 w-full items-center rounded-lg border shadow-sm transition focus-within:ring-2 sm:h-8 sm:w-auto sm:shrink-0 ${statusColor}`}>
        <span className="flex h-full items-center border-r border-current/15 px-2 text-[9px] font-bold uppercase tracking-[0.09em] opacity-75">
          Asset status
        </span>
        <SearchableDropdown
          name="status"
          form={formId}
          value={status}
          onValueChange={setStatus}
          required
          placeholder="Search statuses..."
          options={PRINTER_STATUSES.map((item) => ({ value: item, label: item }))}
          className="min-w-0 flex-1 sm:min-w-32"
          inputClassName="!h-[1.875rem] !rounded-l-none !rounded-r-lg !border-0 !bg-transparent !px-2.5 !pr-8 !text-xs !font-bold !shadow-none !ring-0"
        />
      </div>
    );
  }

  return (
    <SearchableDropdown label="Asset Status" name="status" form={formId} value={status} onValueChange={setStatus} required placeholder="Search statuses..." options={PRINTER_STATUSES.map((item) => ({ value: item, label: item }))} className="min-w-48" inputClassName={`font-semibold ${statusColor}`} labelClassName="!text-xs !text-slate-600" />
  );
}
