"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { PRINTER_STATUSES } from "@/lib/constants";
import { statusBadgeColor } from "@/components/ui";
import { notifyActionPromise } from "@/lib/toast-notifications";
import { updatePrinterStatusAction } from "../../actions";
import AuthBlob, { type BlobMood } from "@/components/AuthBlob";
import { useBlobSkin } from "@/components/BlobSkinProvider";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

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
  compact = false,
}: {
  currentStatus: string;
  formId: string;
  printerId: number;
  compact?: boolean;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [nextStatus, setNextStatus] = useState<string | null>(null);
  const [mood, setMood] = useState<BlobMood>("idle");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { blobSkin } = useBlobSkin();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const statusColor = STATUS_COLORS[statusBadgeColor(status)];
  useBodyScrollLock(nextStatus !== null);

  useEffect(() => {
    if (!nextStatus) return;
    const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        event.preventDefault();
        setNextStatus(null);
        setMood("idle");
        return;
      }
      if (event.key !== "Tab") return;

      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPending, nextStatus]);

  function openDialog(value: string) {
    if (value === status) return;
    setMood("idle");
    setNextStatus(value);
  }

  function closeDialog() {
    if (isPending) return;
    setNextStatus(null);
    setMood("idle");
  }

  function confirmStatusChange() {
    if (!nextStatus || nextStatus === status || isPending) return;
    const selectedStatus = nextStatus;
    setMood("concerned");

    startTransition(async () => {
      const savePromise = (async () => {
        const result = await updatePrinterStatusAction(printerId, selectedStatus);
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
        setStatus(selectedStatus);
        setNextStatus(null);
        setMood("success");
        router.refresh();
      } catch {
        setMood("concerned");
      }
    });
  }

  return (
    <>
      <div className={`flex flex-col ${compact ? "gap-1" : "gap-1.5"}`}>
        <label htmlFor="printer-status" className="text-xs font-medium text-slate-600">
          Asset Status
        </label>
        <select
          id="printer-status"
          name="status"
          form={formId}
          value={status}
          onChange={(event) => openDialog(event.target.value)}
          disabled={isPending || nextStatus !== null}
          required
          className={`${compact ? "min-w-32 px-3 py-1.5 text-xs" : "min-w-48 px-3.5 py-2.5 text-sm"} rounded-lg border font-semibold outline-none transition focus:ring-2 disabled:cursor-wait disabled:opacity-70 ${statusColor}`}
        >
          {PRINTER_STATUSES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </div>

      {nextStatus && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="printer-status-dialog-title"
            aria-describedby="printer-status-dialog-description"
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-7"
          >
            <AuthBlob mood={mood} size={148} skin={blobSkin} className="mx-auto -mt-3 -mb-2" />
            <h2 id="printer-status-dialog-title" className="mt-2 text-xl font-bold text-[#014171]">
              Change asset status?
            </h2>
            <p id="printer-status-dialog-description" className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
              Change printer status from <strong>{status}</strong> to <strong>{nextStatus}</strong>? This change will be saved immediately.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                ref={cancelRef}
                type="button"
                disabled={isPending}
                onClick={closeDialog}
                onMouseEnter={() => setMood("success")}
                onMouseLeave={() => setMood("idle")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={confirmStatusChange}
                onMouseEnter={() => setMood("concerned")}
                onMouseLeave={() => !isPending && setMood("idle")}
                className="rounded-lg bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:cursor-wait disabled:opacity-65"
              >
                {isPending ? "Updating…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
