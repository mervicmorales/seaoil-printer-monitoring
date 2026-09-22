"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide";
import { MorphIcon } from "morphicons/react";

export default function RefreshControl({
  refreshedAtLabel,
  intervalSeconds,
  iconOnly = false,
}: {
  refreshedAtLabel: string;
  intervalSeconds: number;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [isRefreshing, startRefresh] = useTransition();

  function refresh() {
    startRefresh(() => router.refresh());
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      startRefresh(() => router.refresh());
    }, intervalSeconds * 1_000);
    return () => window.clearInterval(timer);
  }, [intervalSeconds, router]);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2.5">
      <span className="text-[11px] font-medium text-slate-500" aria-live="polite">
        Last refreshed: {refreshedAtLabel}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={isRefreshing}
        aria-label={isRefreshing ? "Refreshing printer records" : "Refresh printer records"}
        title={isRefreshing ? "Refreshing…" : "Refresh"}
        className={iconOnly
          ? "inline-flex size-9 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
          : "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"}
      >
        <MorphIcon
          icon={RefreshCw}
          size={14}
          strokeWidth={2}
          reducedMotion="user"
          className={isRefreshing ? "animate-spin" : ""}
        />
        {!iconOnly && (isRefreshing ? "Refreshing…" : "Refresh")}
      </button>
    </div>
  );
}
