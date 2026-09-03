"use client";

import { useState } from "react";
import { statusBadgeColor } from "@/components/ui";
import { REPAIR_STATUSES } from "@/lib/constants";

const STATUS_COLORS = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-700 focus:border-emerald-500 focus:ring-emerald-200",
  yellow: "border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-500 focus:ring-amber-200",
  red: "border-red-300 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-200",
  blue: "border-sky-300 bg-sky-50 text-sky-700 focus:border-sky-500 focus:ring-sky-200",
  gray: "border-slate-300 bg-slate-50 text-slate-700 focus:border-slate-500 focus:ring-slate-200",
  orange: "border-orange-300 bg-orange-50 text-orange-700 focus:border-orange-500 focus:ring-orange-200",
} as const;

export default function TicketStatusSelect({
  currentStatus,
  formId,
  compact = false,
}: {
  currentStatus: string;
  formId: string;
  compact?: boolean;
}) {
  const [status, setStatus] = useState(currentStatus);
  const statusColor = STATUS_COLORS[statusBadgeColor(status)];

  function handleStatusChange(nextStatus: string) {
    setStatus(nextStatus);
    window.dispatchEvent(
      new CustomEvent("repair-ticket-status-change", {
        detail: { formId, status: nextStatus },
      }),
    );
  }

  return (
    <div className={compact ? "flex items-center gap-2" : "flex flex-col gap-1.5"}>
      <label htmlFor={`${formId}-status`} className="text-xs font-medium text-slate-600">
        Ticket Status
      </label>
      <select
        id={`${formId}-status`}
        name="status"
        form={formId}
        value={status}
        onChange={(event) => handleStatusChange(event.target.value)}
        required
        className={`${compact ? "min-w-36 px-3 py-2 text-xs" : "min-w-48 px-3.5 py-2.5 text-sm"} rounded-xl border font-semibold shadow-sm outline-none transition focus:ring-2 ${statusColor}`}
      >
        {REPAIR_STATUSES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </div>
  );
}
