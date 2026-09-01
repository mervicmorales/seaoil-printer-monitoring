"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { createPortal } from "react-dom";
import AuthBlob, { type BlobMood } from "@/components/AuthBlob";
import { useBlobSkin } from "@/components/BlobSkinProvider";

function ConfirmDeleteButton({
  label,
  onConfirm,
  onConcern,
  onNeutral,
  disabled,
}: {
  label: string;
  onConfirm: () => void;
  onConcern: () => void;
  onNeutral: () => void;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending || disabled}
      onClick={onConfirm}
      onMouseEnter={onConcern}
      onMouseLeave={onNeutral}
      className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-65"
    >
      {pending ? "Deleting…" : label}
    </button>
  );
}

export default function BlobDeleteButton({
  action,
  id,
  title = "Delete item?",
  confirmText = "This item will be permanently deleted. This action cannot be undone.",
  label = "Delete",
  confirmLabel = "Delete",
  requireReason = false,
  reasonLabel = "Reason for deletion",
  reasonPlaceholder = "Enter the reason for deleting this record",
  className = "rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100",
}: {
  action: (formData: FormData) => void | Promise<void>;
  id: number;
  title?: string;
  confirmText?: string;
  label?: string;
  confirmLabel?: string;
  requireReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  className?: string;
}) {
  const { blobSkin } = useBlobSkin();
  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<BlobMood>("idle");
  const [reason, setReason] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const titleId = `${generatedId}-title`;
  const descriptionId = `${generatedId}-description`;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      if (requireReason) reasonRef.current?.focus();
      else cancelRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;

      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (controls.length === 0) return;
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
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, requireReason]);

  function openDialog() {
    setMood("idle");
    setReason("");
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setMood("idle");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        className={className}
      >
        {label}
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
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-7"
          >
            <AuthBlob mood={mood} size={148} skin={blobSkin} className="mx-auto -mt-3 -mb-2" />
            <h2 id={titleId} className="mt-2 text-xl font-bold text-[#014171]">
              {title}
            </h2>
            <p id={descriptionId} className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
              {confirmText}
            </p>

            <form action={action} className="mt-6 grid grid-cols-2 gap-3 text-left">
              <input type="hidden" name="id" value={id} />
              {requireReason && (
                <label className="col-span-2 text-sm font-medium text-slate-700">
                  {reasonLabel} <span className="text-red-500">*</span>
                  <textarea
                    ref={reasonRef}
                    name="deletionReason"
                    required
                    minLength={3}
                    rows={3}
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={reasonPlaceholder}
                    className="mt-1.5 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40"
                  />
                </label>
              )}
              <button
                ref={cancelRef}
                type="button"
                onClick={closeDialog}
                onMouseEnter={() => setMood("success")}
                onMouseLeave={() => setMood("idle")}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
              >
                Cancel
              </button>
              <ConfirmDeleteButton
                label={confirmLabel}
                onConfirm={() => setMood("goodbye")}
                onConcern={() => setMood("concerned")}
                onNeutral={() => setMood("idle")}
                disabled={requireReason && reason.trim().length < 3}
              />
            </form>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
