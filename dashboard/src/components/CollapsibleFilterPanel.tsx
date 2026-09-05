"use client";

import { useId, useState, type ReactNode } from "react";
import { Card } from "@/components/ui";

export default function CollapsibleFilterPanel({
  children,
  activeFilterCount = 0,
  defaultOpen,
  className = "mb-5",
}: {
  children: ReactNode;
  activeFilterCount?: number;
  defaultOpen?: boolean;
  className?: string;
}) {
  const panelId = useId();
  const hasActiveFilters = activeFilterCount > 0;
  const [openOverride, setOpenOverride] = useState<{ hasActiveFilters: boolean; open: boolean } | null>(null);
  const isOpen = openOverride?.hasActiveFilters === hasActiveFilters
    ? openOverride.open
    : (defaultOpen ?? hasActiveFilters);

  return (
    <Card className={`${className} overflow-hidden`}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setOpenOverride({ hasActiveFilters, open: !isOpen })}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold text-[#014171] transition hover:bg-slate-50/80 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#014171]"
      >
        <span className="flex items-center gap-2">
          Filters
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#014171] px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              {activeFilterCount}
            </span>
          )}
        </span>
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">
          {isOpen ? "Hide Filters" : "Show Filters"}
        </span>
      </button>
      <div id={panelId} hidden={!isOpen} className="border-t border-slate-200 bg-slate-50/35 p-4">{children}</div>
    </Card>
  );
}
