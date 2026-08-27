"use client";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { createPortal } from "react-dom";
import AuthBlob, { type BlobMood } from "@/components/AuthBlob";
import { useBlobSkin } from "@/components/BlobSkinProvider";
import { logoutAction } from "@/app/(app)/shell-actions";
import { gooeyToast } from "goey-toast";

export default function LogoutConfirmationDialog({
  open,
  onClose,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const { blobSkin } = useBlobSkin();
  const [mood, setMood] = useState<BlobMood>("idle");
  const [signingOut, startSignOut] = useTransition();
  const signingOutRef = useRef(signingOut);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    signingOutRef.current = signingOut;
  }, [signingOut]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => cancelRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !signingOutRef.current) {
        event.preventDefault();
        onClose();
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;

      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])',
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
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  function closeDialog() {
    if (signingOut) return;
    setMood("idle");
    onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function confirmSignOut() {
    if (signingOut) return;
    setMood("goodbye");
    startSignOut(async () => {
      try {
        const result = await logoutAction();
        if (!result.success) throw new Error("Sign out did not complete");

        window.location.replace("/login");
      } catch {
        setMood("concerned");
        gooeyToast.error("Sign out failed", {
          id: "auth-sign-out-failed",
          description: "Your session is still active. Please try again.",
        });
      }
    });
  }

  return createPortal(
    <div
      data-logout-dialog
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        aria-describedby="logout-dialog-description"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-2xl sm:p-7"
      >
        <AuthBlob mood={mood} size={148} skin={blobSkin} className="mx-auto -mt-3 -mb-2" />
        <h2 id="logout-dialog-title" className="mt-2 text-xl font-bold text-[#014171]">
          Sign out?
        </h2>
        <p id="logout-dialog-description" className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-600">
          You’ll need to sign in again to access printer monitoring and administration.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            ref={cancelRef}
            type="button"
            disabled={signingOut}
            onClick={closeDialog}
            onMouseEnter={() => setMood("success")}
            onMouseLeave={() => setMood("idle")}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={signingOut}
            onClick={confirmSignOut}
            onMouseEnter={() => setMood("concerned")}
            onMouseLeave={() => setMood("idle")}
            className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
