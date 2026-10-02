"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide";
import { MorphIcon } from "morphicons/react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export default function SystemDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  width = "max-w-xl",
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  const [visible, setVisible] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const close = useCallback(() => {
    setVisible(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      onClose();
    }, 280);
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close, open]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex items-stretch justify-end bg-[#014171]/70 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex h-dvh w-full ${width} flex-col overflow-hidden border-l border-white/20 bg-[#f4f7fa] shadow-[0_28px_80px_rgba(15,23,42,0.32)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${visible ? "translate-x-0" : "translate-x-full"}`}
      >
        <header className="flex h-[55px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold tracking-[-0.015em] text-[#014171]">{title}</h2>
            {subtitle && <p className="truncate text-xs font-medium text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={`Close ${title.toLowerCase()}`}
            className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
          >
            <MorphIcon icon={X} size={17} strokeWidth={2} reducedMotion="user" />
          </button>
        </header>
        <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
      </section>
    </div>
  );
}
