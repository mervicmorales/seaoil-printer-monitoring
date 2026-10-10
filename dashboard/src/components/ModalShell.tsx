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
        className={`flex w-full flex-col overflow-hidden bg-app-canvas text-app-ink shadow-[0_28px_80px_rgba(15,23,42,0.32)] ${
          isRightPanel
            ? `h-dvh border-l border-white/20 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isVisible ? "translate-x-0" : "translate-x-full"}`
            : "max-h-[calc(100dvh-1.5rem)] rounded-2xl border border-app-border sm:max-h-[calc(100dvh-3rem)]"
        } ${panelClassName ?? (isRightPanel ? "max-w-[56rem]" : "max-w-6xl")}`}
      >
        <div className={`grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-2 border-b border-app-border bg-app-surface px-4 py-2 sm:flex sm:flex-nowrap sm:gap-3 sm:px-6 ${isRightPanel ? "sm:min-h-[55px]" : "sm:py-3"}`}>
          {pageHeaderInModal ? (
            <div id="modal-page-header-slot" className="min-w-0 flex-1" />
          ) : (
            <div className={showTitle ? "min-w-0 pr-2 sm:pr-3" : "sr-only"}>
              <h2 className="text-base font-bold leading-5 tracking-[-0.015em] text-app-primary sm:truncate">{title}</h2>
              {subtitle && <p className="mt-0.5 truncate text-xs font-medium text-app-muted">{subtitle}</p>}
            </div>
          )}
          {headerActions && (
            <div className="col-span-2 row-start-2 flex min-w-0 flex-wrap items-center gap-2 sm:order-none sm:ml-auto sm:flex-nowrap">
              {headerActions}
            </div>
          )}
          <button
            type="button"
            onClick={close}
            aria-label={`Close ${title.toLowerCase()}`}
            className={`col-start-2 row-start-1 flex size-9 shrink-0 items-center justify-center rounded-xl border border-app-border bg-app-surface text-app-muted shadow-sm transition hover:border-app-border-strong hover:bg-app-surface-raised hover:text-app-ink focus:outline-none focus:ring-2 focus:ring-app-focus sm:order-last ${closeButtonClassName}`}
          >
            <MorphIcon icon={X} size={17} strokeWidth={2} reducedMotion="user" />
          </button>
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
