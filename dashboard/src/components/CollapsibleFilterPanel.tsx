import type { ReactNode } from "react";
import { Card } from "@/components/ui";

export default function CollapsibleFilterPanel({
  children,
  activeFilterCount = 0,
  className = "mb-5",
}: {
  children: ReactNode;
  activeFilterCount?: number;
  className?: string;
}) {
  return (
    <Card className={`${className} overflow-hidden`}>
      <details className="group" open={activeFilterCount > 0 ? true : undefined}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-semibold text-[#014171] transition hover:bg-slate-50/80 [&::-webkit-details-marker]:hidden">
          <span className="flex items-center gap-2">
            Filters
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-[#014171] px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                {activeFilterCount}
              </span>
            )}
          </span>
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm">
            <span className="group-open:hidden">Show Filters</span>
            <span className="hidden group-open:inline">Hide Filters</span>
          </span>
        </summary>
        <div className="border-t border-slate-200 bg-slate-50/35 p-4">{children}</div>
      </details>
    </Card>
  );
}
