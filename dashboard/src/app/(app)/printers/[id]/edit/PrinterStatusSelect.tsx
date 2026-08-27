"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PRINTER_STATUSES } from "@/lib/constants";
import { statusBadgeColor } from "@/components/ui";
import { notifyActionPromise } from "@/lib/toast-notifications";
import { updatePrinterStatusAction } from "../../actions";

const STATUS_COLORS = {
  green: "border-emerald-300 bg-emerald-50 text-emerald-700 focus:border-emerald-500 focus:ring-emerald-200",
  yellow: "border-amber-300 bg-amber-50 text-amber-700 focus:border-amber-500 focus:ring-amber-200",
  red: "border-red-300 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-200",
  blue: "border-sky-300 bg-sky-50 text-sky-700 focus:border-sky-500 focus:ring-sky-200",
  gray: "border-slate-300 bg-slate-50 text-slate-700 focus:border-slate-500 focus:ring-slate-200",
  orange: "border-orange-300 bg-orange-50 text-orange-700 focus:border-orange-500 focus:ring-orange-200",
} as const;

export default function PrinterStatusSelect({
  currentStatus,
  formId,
  printerId,
}: {
  currentStatus: string;
  formId: string;
  printerId: number;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const statusColor = STATUS_COLORS[statusBadgeColor(status)];

  function confirmStatusChange(nextStatus: string) {
    if (nextStatus === status) return;
    const confirmed = window.confirm(
      `Change printer status from "${status}" to "${nextStatus}"? This change will be saved immediately.`,
    );
    if (!confirmed) return;

    startTransition(async () => {
      const savePromise = (async () => {
        const result = await updatePrinterStatusAction(printerId, nextStatus);
        if (!result.success) throw new Error("Status update failed");
        return result;
      })();

      notifyActionPromise(savePromise, {
        loading: "Updating printer status...",
        success: "Printer status updated",
        error: "Could not update printer status",
      });

      try {
        await savePromise;
        setStatus(nextStatus);
        router.refresh();
      } catch {
        // The toast provides a safe user-facing error without exposing internals.
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="printer-status" className="text-xs font-medium text-slate-600">
        Asset Status
      </label>
      <select
        id="printer-status"
        name="status"
        form={formId}
        value={status}
        onChange={(event) => confirmStatusChange(event.target.value)}
        disabled={isPending}
        required
        className={`min-w-48 rounded-lg border px-3.5 py-2.5 text-sm font-semibold outline-none transition focus:ring-2 disabled:cursor-wait disabled:opacity-70 ${statusColor}`}
      >
        {PRINTER_STATUSES.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
    </div>
  );
}
