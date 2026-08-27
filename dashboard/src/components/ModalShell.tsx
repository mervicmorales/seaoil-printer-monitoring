"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ModalShell({
  children,
  title,
  closeHref,
  showTitle = true,
}: {
  children: ReactNode;
  title: string;
  closeHref?: string;
  showTitle?: boolean;
}) {
  const router = useRouter();
  const close = useCallback(() => {
    if (closeHref) {
      router.push(closeHref);
      return;
    }
    router.back();
  }, [closeHref, router]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-[1px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f6f9] shadow-2xl sm:max-h-[calc(100dvh-3rem)]"
      >
        <div className={`flex shrink-0 items-center border-b border-slate-200 bg-white px-4 py-3 sm:px-6 ${showTitle ? "justify-between" : "justify-end"}`}>
          <h2 className={showTitle ? "text-sm font-semibold text-[#014171]" : "sr-only"}>{title}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={`Close ${title.toLowerCase()}`}
            className="flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-xl leading-none text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-4 sm:p-6">{children}</div>
      </section>
    </div>
  );
}
