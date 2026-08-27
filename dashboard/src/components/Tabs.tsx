"use client";

import { useState, type ReactNode } from "react";

export default function Tabs({
  tabs,
  defaultKey,
  fillHeight = false,
}: {
  tabs: { key: string; label: string; content: ReactNode }[];
  defaultKey?: string;
  fillHeight?: boolean;
}) {
  const [active, setActive] = useState(defaultKey && tabs.some((t) => t.key === defaultKey) ? defaultKey : tabs[0]?.key);
  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col" : ""}>
      <div className={`mb-5 flex flex-wrap gap-2 border-b border-slate-200 ${fillHeight ? "shrink-0" : ""}`}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${
              active === t.key
                ? "border-[#014171] text-[#014171]"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={fillHeight ? "min-h-0 flex-1" : ""}>
        {tabs.find((t) => t.key === active)?.content}
      </div>
    </div>
  );
}
