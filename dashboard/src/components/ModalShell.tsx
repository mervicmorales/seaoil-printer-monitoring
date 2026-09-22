"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide";
import { MorphIcon } from "morphicons/react";
import { PageHeaderPlacement } from "@/components/PageHeaderPortal";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export default function ModalShell({
  children,
  title,
  subtitle,
  closeHref,
  showTitle = true,
  headerActions,
  pageHeaderInModal = false,
  hideScrollbar = false,
  contentClassName = "",
  panelClassName,
  closeButtonClassName = "",
  variant = "dialog",
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  closeHref?: string;
  showTitle?: boolean;
  headerActions?: ReactNode;
  pageHeaderInModal?: boolean;
  hideScrollbar?: boolean;
  contentClassName?: string;
  panelClassName?: string;
  closeButtonClassName?: string;
  variant?: "dialog" | "right-panel";
}) {
  const router = useRouter();
  const isRightPanel = variant === "right-panel";
  const [isVisible, setIsVisible] = useState(!isRightPanel);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useBodyScrollLock(true);

  useEffect(() => {
    if (!isRightPanel) return;
    const frame = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [isRightPanel]);

  useEffect(() => () => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  const close = useCallback(() => {
    const navigateAway = () => {
      if (closeHref) {
        router.push(closeHref);
        return;
      }
      router.back();
    };

    if (!isRightPanel) {
      navigateAway();
      return;
    }

    setIsVisible(false);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(navigateAway, 280);
  }, [closeHref, isRightPanel, router]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [close]);

  return (
    <div
      className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${
        isRightPanel
          ? `items-stretch justify-end bg-[#014171]/70 p-0 ${isVisible ? "opacity-100" : "opacity-0"}`
          : "items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-6"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex w-full flex-col overflow-hidden bg-[#f4f7fa] shadow-[0_28px_80px_rgba(15,23,42,0.32)] ${
          isRightPanel
            ? `h-dvh border-l border-white/20 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isVisible ? "translate-x-0" : "translate-x-full"}`
            : "max-h-[calc(100dvh-1.5rem)] rounded-2xl border border-slate-200 sm:max-h-[calc(100dvh-3rem)]"
        } ${panelClassName ?? (isRightPanel ? "max-w-[56rem]" : "max-w-6xl")}`}
      >
        <div className={`flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6 ${isRightPanel ? "h-[55px]" : "py-3"}`}>
          {pageHeaderInModal ? (
            <div id="modal-page-header-slot" className="min-w-0 flex-1" />
          ) : (
            <div className={showTitle ? "min-w-0 pr-3" : "sr-only"}>
              <h2 className="truncate text-base font-bold tracking-[-0.015em] text-[#014171]">{title}</h2>
              {subtitle && <p className="mt-0.5 truncate text-xs font-medium text-slate-500">{subtitle}</p>}
            </div>
          )}
          <div className="flex items-center gap-2">
            {headerActions}
            <button
              type="button"
              onClick={close}
              aria-label={`Close ${title.toLowerCase()}`}
              className={`flex size-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] ${closeButtonClassName}`}
            >
              <MorphIcon icon={X} size={17} strokeWidth={2} reducedMotion="user" />
            </button>
          </div>
        </div>
        <PageHeaderPlacement inAppHeader={false} inModalHeader={pageHeaderInModal}>
          <div className={`min-h-0 overflow-y-auto p-4 sm:p-6 ${hideScrollbar || isRightPanel ? "scrollbar-hidden" : ""} ${contentClassName}`}>
            {children}
          </div>
        </PageHeaderPlacement>
      </section>
    </div>
  );
}
