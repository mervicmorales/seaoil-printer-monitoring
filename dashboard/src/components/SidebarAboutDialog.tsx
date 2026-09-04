"use client";

import { useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { FileCheck2, Info, Printer, ScanLine, ShieldCheck, X, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type AboutContent = {
  eyebrow: string;
  title: string;
  description: string;
  features: Array<{ icon: IconNode; label: string }>;
};

const EMPLOYEE_CONTENT: AboutContent = {
  eyebrow: "Employee workspace",
  title: "SEAOIL PrintOps",
  description:
    "A secure workspace for SEAOIL employees to print and scan using available workplace devices across company locations. It keeps everyday document services accessible wherever employees are assigned.",
  features: [
    { icon: Printer, label: "Print using available workplace devices" },
    { icon: ScanLine, label: "Scan documents through connected scanners" },
    { icon: ShieldCheck, label: "Access services through a verified employee account" },
  ],
};

const MANAGEMENT_CONTENT: AboutContent = {
  eyebrow: "Management workspace",
  title: "SEAOIL Printer Management System",
  description:
    "A centralized workspace for authorized SEAOIL teams to manage printers and support employee print services across company locations. It brings device monitoring, toner, repairs, user access, printing, and scanning into one operational view.",
  features: [
    { icon: Printer, label: "Monitor printers and workplace device availability" },
    { icon: FileCheck2, label: "Coordinate toner, repairs, and service records" },
    { icon: ShieldCheck, label: "Support secure employee print and scan access" },
  ],
};

export default function SidebarAboutDialog({
  open,
  employeeMode,
  onClose,
  triggerRef,
}: {
  open: boolean;
  employeeMode: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const content = employeeMode ? EMPLOYEE_CONTENT : MANAGEMENT_CONTENT;
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
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
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  function closeDialog() {
    onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sidebar-about-title"
        aria-describedby="sidebar-about-description"
        className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.28)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/75 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#014171] text-white shadow-sm">
              <MorphIcon icon={Info} size={18} strokeWidth={2} reducedMotion="user" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#507aa2]">{content.eyebrow}</p>
              <h2 id="sidebar-about-title" className="mt-1 text-lg font-bold leading-6 tracking-[-0.02em] text-[#014171]">
                {content.title}
              </h2>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDialog}
            aria-label="Close About"
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
          >
            <MorphIcon icon={X} size={17} strokeWidth={2} reducedMotion="user" />
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          <p id="sidebar-about-description" className="text-sm leading-6 text-slate-600">
            {content.description}
          </p>

          <div className="mt-5 space-y-2.5">
            {content.features.map((feature) => (
              <div key={feature.label} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#014171]">
                  <MorphIcon icon={feature.icon} size={15} strokeWidth={2} reducedMotion="user" />
                </span>
                <p className="text-xs font-semibold leading-5 text-slate-700">{feature.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 border-t border-slate-200 pt-4">
            <p className="text-[11px] font-medium text-slate-400">For internal SEAOIL use only.</p>
            <button
              type="button"
              onClick={closeDialog}
              className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[#014171] px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
