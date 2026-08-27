"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function RefreshControl({
  refreshedAtLabel,
  intervalSeconds,
}: {
  refreshedAtLabel: string;
  intervalSeconds: number;
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
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="text-xs text-slate-400" aria-live="polite">
        Last refreshed: {refreshedAtLabel}
      </span>
      <button
        type="button"
        onClick={refresh}
        disabled={isRefreshing}
        className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
      >
        {isRefreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}
