"use client";

import { useState, type ReactNode } from "react";
import type { IconNode } from "lucide";
import { IconGlyph } from "@/components/ui";

export default function Tabs({
  tabs,
  defaultKey,
  fillHeight = false,
  variant = "underline",
}: {
  tabs: { key: string; label: string; icon?: IconNode; content: ReactNode }[];
  defaultKey?: string;
  fillHeight?: boolean;
  variant?: "underline" | "segmented";
}) {
  const [active, setActive] = useState(defaultKey && tabs.some((t) => t.key === defaultKey) ? defaultKey : tabs[0]?.key);
  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col" : ""}>
      <div
        role="tablist"
        className={`${variant === "segmented"
          ? "mb-4 grid grid-flow-col auto-cols-fr gap-1 overflow-x-auto rounded-xl bg-app-surface-subtle p-1"
          : "mb-5 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-app-border"
        } ${fillHeight ? "shrink-0" : ""}`}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={`inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold transition ${variant === "segmented"
              ? `rounded-lg ${active === t.key
                ? "bg-app-surface-raised text-app-primary shadow-sm"
                : "text-app-muted hover:bg-app-surface-raised hover:text-app-ink-soft"}`
              : `-mb-px rounded-t-xl border-b-2 ${active === t.key
                ? "border-app-primary bg-app-surface-raised text-app-primary"
                : "border-transparent text-app-muted hover:bg-app-surface-subtle hover:text-app-ink-soft"}`
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
