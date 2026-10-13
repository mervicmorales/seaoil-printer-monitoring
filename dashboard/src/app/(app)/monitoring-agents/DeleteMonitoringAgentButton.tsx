"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide";
import { IconGlyph } from "@/components/ui";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export default function DeleteMonitoringAgentButton({
  agentId,
  agentName,
  onDeleted,
}: {
  agentId: number;
  agentName: string;
  onDeleted: (agentId: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;
  useBodyScrollLock(open);

  const closeDialog = useCallback(() => {
    if (deleting) return;
    setOpen(false);
    setError(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [deleting]);

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !deleting) {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;

      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!controls.length) return;
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
  }, [closeDialog, deleting, open]);

  function openDialog() {
    setError(null);
    setOpen(true);
  }

  async function deleteAgent() {
    setDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/monitoring/agents/${agentId}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });
      const body = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !body.success) {
        throw new Error(body.message || "Unable to delete monitoring agent");
      }
      setOpen(false);
      onDeleted(agentId);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete monitoring agent");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        aria-label={`Delete monitoring agent ${agentName}`}
        title={`Delete ${agentName}`}
        className="inline-flex size-9 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-600"
      >
        <IconGlyph icon={Trash2} size={15} />
      </button>

      {open && createPortal(
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
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
          >
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-700">
              <IconGlyph icon={Trash2} size={20} />
            </div>
            <h2 id={titleId} className="mt-4 text-center text-lg font-bold text-[#014171]">
              Delete monitoring agent?
            </h2>
            <p id={descriptionId} className="mt-2 text-center text-sm leading-6 text-slate-600">
              Delete <strong className="font-bold text-slate-800">{agentName}</strong>? Its credentials, office coverage, and saved discovery scans will be permanently removed.
            </p>
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              Agents with assigned printers or monitoring history cannot be deleted. Monitoring history will never be erased by this action.
            </p>
            {error && (
              <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">
                {error}
              </p>
            )}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                ref={cancelRef}
                type="button"
                onClick={closeDialog}
                disabled={deleting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void deleteAgent()}
                disabled={deleting}
                className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-wait disabled:opacity-65"
              >
                {deleting ? "Deleting…" : "Delete agent"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
