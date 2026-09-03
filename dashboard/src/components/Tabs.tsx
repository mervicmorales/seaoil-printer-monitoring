"use client";

import { useState, type ReactNode } from "react";
import type { IconNode } from "lucide";
import { IconGlyph } from "@/components/ui";

export default function Tabs({
  tabs,
  defaultKey,
  fillHeight = false,
}: {
  tabs: { key: string; label: string; icon?: IconNode; content: ReactNode }[];
  defaultKey?: string;
  fillHeight?: boolean;
}) {
  const [active, setActive] = useState(defaultKey && tabs.some((t) => t.key === defaultKey) ? defaultKey : tabs[0]?.key);
  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col" : ""}>
      <div
        role="tablist"
        className={`mb-5 flex gap-1 overflow-x-auto border-b border-slate-200 ${fillHeight ? "shrink-0" : ""}`}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-sm font-semibold transition ${
              active === t.key
                ? "border-[#014171] bg-sky-50/60 text-[#014171]"
                : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            }`}
          >
            {t.icon && <IconGlyph icon={t.icon} size={16} />}
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className={fillHeight ? "min-h-0 flex-1" : ""}>
        {tabs.find((t) => t.key === active)?.content}
      </div>
    </div>
  );
}
