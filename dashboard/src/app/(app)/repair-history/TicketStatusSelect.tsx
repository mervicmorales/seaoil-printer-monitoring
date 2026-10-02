"use client";

import { useState } from "react";
import { statusBadgeColor } from "@/components/ui";
import { REPAIR_STATUSES } from "@/lib/constants";
import SearchableDropdown from "@/components/SearchableDropdown";

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

  const dropdown = (
    <SearchableDropdown
      label={compact ? undefined : "Ticket Status"}
      ariaLabel={compact ? "Ticket Status" : undefined}
      name="status"
      form={formId}
      value={status}
      onValueChange={handleStatusChange}
      required
      placeholder="Search statuses..."
      options={REPAIR_STATUSES.map((item) => ({ value: item, label: item }))}
      className={compact ? "w-36 shrink-0" : "min-w-48"}
      inputClassName={`${compact ? "!h-9 !text-xs" : ""} font-semibold ${statusColor}`}
      labelClassName="!text-xs !text-slate-600"
    />
  );

  if (!compact) return dropdown;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <span className="whitespace-nowrap text-xs font-medium text-slate-600">
        Ticket Status <span className="text-red-500">*</span>
      </span>
      {dropdown}
    </div>
  );
}
