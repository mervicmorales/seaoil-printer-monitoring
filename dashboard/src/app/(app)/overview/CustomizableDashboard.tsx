"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  Check,
  Eye,
  EyeOff,
  GripVertical,
  Maximize2,
  Minimize2,
  RotateCcw,
  Settings2,
  X,
} from "lucide";
import {
  ResponsiveGridLayout,
  useContainerWidth,
  verticalCompactor,
  type Layout,
  type LayoutItem,
  type ResponsiveLayouts,
} from "react-grid-layout";
import { IconGlyph } from "@/components/ui";

const widgetIds = ["expenses", "movement", "accounts", "fleet", "inventory", "operations", "recent"] as const;
type WidgetId = (typeof widgetIds)[number];
type DashboardBreakpoint = "lg" | "md" | "sm";
type WidgetMode = "normal" | "minimized" | "maximized";

export type DashboardWidget = {
  id: WidgetId;
  title: string;
  content: ReactNode;
};

type StoredDashboard = {
  version: 2;
  layouts: ResponsiveLayouts<DashboardBreakpoint>;
  hidden: WidgetId[];
  modes: Partial<Record<WidgetId, WidgetMode>>;
};

const breakpoints: Record<DashboardBreakpoint, number> = { lg: 1000, md: 640, sm: 0 };
const columns: Record<DashboardBreakpoint, number> = { lg: 12, md: 8, sm: 1 };
const rowHeight = 28;
const gridMargin = [12, 12] as const;
const gridContainerPadding = [0, 0] as const;

const defaultLayouts: ResponsiveLayouts<DashboardBreakpoint> = {
  lg: [
    item("expenses", 0, 0, 6, 13, 5, 6),
    item("movement", 6, 0, 6, 13, 4, 7),
    item("accounts", 0, 13, 4, 5, 4, 3),
    item("fleet", 4, 13, 5, 5, 5, 3),
    item("inventory", 9, 13, 3, 19, 3, 5),
    item("operations", 0, 18, 9, 14, 6, 8),
    item("recent", 0, 32, 12, 10, 4, 5),
  ],
  md: [
    item("accounts", 0, 0, 8, 5, 4, 3),
    item("fleet", 0, 5, 8, 5, 4, 3),
    item("operations", 0, 10, 8, 15, 4, 8),
    item("expenses", 0, 25, 8, 13, 4, 6),
    item("movement", 0, 38, 8, 11, 4, 7),
    item("inventory", 0, 49, 8, 12, 4, 5),
    item("recent", 0, 61, 8, 9, 4, 5),
  ],
  sm: [
    item("accounts", 0, 0, 1, 7, 1, 3),
    item("fleet", 0, 7, 1, 11, 1, 3),
    item("operations", 0, 18, 1, 20, 1, 10),
    item("expenses", 0, 38, 1, 16, 1, 6),
    item("movement", 0, 54, 1, 14, 1, 8),
    item("inventory", 0, 68, 1, 13, 1, 5),
    item("recent", 0, 81, 1, 12, 1, 5),
  ],
};

const staticSpan: Record<WidgetId, string> = {
  accounts: "xl:col-span-4",
  fleet: "xl:col-span-5",
  operations: "xl:col-span-9",
  expenses: "xl:col-span-6",
  movement: "xl:col-span-6",
  inventory: "xl:col-span-3",
  recent: "xl:col-span-12",
};

export default function CustomizableDashboard({
  storageKey,
  widgets,
}: {
  storageKey: string;
  widgets: DashboardWidget[];
}) {
  const { width, containerRef, mounted } = useContainerWidth({ measureBeforeMount: true });
  const [editing, setEditing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [breakpoint, setBreakpoint] = useState<DashboardBreakpoint>("lg");
  const [layouts, setLayouts] = useState<ResponsiveLayouts<DashboardBreakpoint>>(() => cloneLayouts(defaultLayouts));
  const [hidden, setHidden] = useState<WidgetId[]>([]);
  const [modes, setModes] = useState<Partial<Record<WidgetId, WidgetMode>>>({});
  const [preferencesReady, setPreferencesReady] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          const saved = parseStoredDashboard(JSON.parse(raw));
          if (saved) {
            setLayouts(saved.layouts);
            setHidden(saved.hidden);
            setModes(saved.modes);
          }
        }
      } catch {
        // Invalid or unavailable browser storage should not block the dashboard.
      } finally {
        setPreferencesReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  useEffect(() => {
    if (!preferencesReady) return;
    const dashboard: StoredDashboard = { version: 2, layouts, hidden, modes };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(dashboard));
    } catch {
      // The layout still works for the current session when storage is unavailable.
    }
  }, [hidden, layouts, modes, preferencesReady, storageKey]);

  const visibleWidgets = useMemo(
    () => widgets
      .filter((widget) => !hidden.includes(widget.id))
      .sort((left, right) => widgetIds.indexOf(left.id) - widgetIds.indexOf(right.id)),
    [hidden, widgets],
  );
  const visibleLayouts = useMemo(
    () => buildVisibleLayouts(layouts, hidden, modes),
    [hidden, layouts, modes],
  );
  const dragConfig = useMemo(
    () => ({ enabled: editing, bounded: true, handle: ".dashboard-drag-handle", cancel: "a,input,select,textarea" }),
    [editing],
  );
  const resizeConfig = useMemo(
    () => ({ enabled: editing, handles: ["se"] as const }),
    [editing],
  );

  function finishEditing() {
    setEditing(false);
    setSettingsOpen(false);
  }

  function resetDashboard() {
    setLayouts(cloneLayouts(defaultLayouts));
    setHidden([]);
    setModes({});
  }

  function toggleWidget(id: WidgetId) {
    setHidden((current) => current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]);
  }

  function setWidgetMode(id: WidgetId, nextMode: WidgetMode) {
    setModes((current) => ({ ...current, [id]: nextMode }));
  }

  const saveChangedLayout = useCallback((nextLayout: Layout) => {
    setLayouts((current) => ({
      ...current,
      [breakpoint]: (current[breakpoint] ?? []).map((baseItem) => {
        const changed = nextLayout.find((layoutItem) => layoutItem.i === baseItem.i);
        if (!changed) return baseItem;
        const mode = modes[baseItem.i as WidgetId] ?? "normal";
        if (mode === "maximized") return { ...baseItem, y: changed.y };
        if (mode === "minimized") return { ...baseItem, x: changed.x, y: changed.y };
        return sanitizeLayoutItem(changed, columns[breakpoint], baseItem);
      }),
    }));
  }, [breakpoint, modes]);

  const changeBreakpoint = useCallback((nextBreakpoint: DashboardBreakpoint) => {
    setBreakpoint((current) => current === nextBreakpoint ? current : nextBreakpoint);
  }, []);

  return (
    <div className="relative">
      <div className="fixed right-0 top-[130px] z-50">
        {preferencesReady && (!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Customize dashboard"
            className="group relative flex h-9 w-9 items-center justify-center rounded-l-md border border-r-0 border-slate-200 bg-white/95 text-[#014171] shadow-md backdrop-blur transition hover:bg-white hover:shadow-lg"
          >
            <span className="transition-transform duration-200 group-hover:rotate-45 group-focus-visible:rotate-45">
              <IconGlyph icon={Settings2} size={14} />
            </span>
            <span className="pointer-events-none absolute right-[calc(100%+0.5rem)] top-1/2 -translate-y-1/2 translate-x-2 scale-95 whitespace-nowrap rounded-md bg-[#014171] px-3 py-2 text-xs font-bold text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:scale-100 group-focus-visible:opacity-100">
              Customize Dashboard
            </span>
          </button>
        ) : (
          <div className="relative flex flex-row items-center gap-1 overflow-visible rounded-l-lg border border-r-0 border-slate-200 bg-white/95 p-1.5 shadow-xl backdrop-blur">
            <p className="sr-only">Drag a panel by its dotted title handle or resize it from the bottom-right corner.</p>
            <FloatingControl label="Choose visible panels" displayLabel="Panels" icon={settingsOpen ? X : Eye} pressed={settingsOpen} onClick={() => setSettingsOpen((open) => !open)} />
            <FloatingControl label="Reset dashboard layout" displayLabel="Reset" icon={RotateCcw} onClick={resetDashboard} />
            <FloatingControl label="Finish customizing" displayLabel="Done" icon={Check} primary onClick={finishEditing} />

            {settingsOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] w-[min(22rem,calc(100vw-4.5rem))] rounded-lg border border-slate-200 bg-white p-2 shadow-xl" role="group" aria-label="Visible dashboard panels">
                <div className="border-b border-slate-100 px-2 pb-2 pt-1">
                  <p className="text-xs font-bold text-slate-800">Visible panels</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Choose which sections appear on your Overview.</p>
                </div>
                <div className="mt-1 grid gap-1 sm:grid-cols-2">
                  {widgets.map((widget) => {
                    const shown = !hidden.includes(widget.id);
                    return (
                      <button key={widget.id} type="button" onClick={() => toggleWidget(widget.id)} aria-pressed={shown} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-slate-50">
                        <span className="truncate">{widget.title}</span>
                        <span className={shown ? "text-emerald-600" : "text-slate-400"}><IconGlyph icon={shown ? Eye : EyeOff} size={15} /></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div ref={containerRef} className="min-w-0">
        {!preferencesReady ? (
          <div
            className="flex min-h-[32rem] items-center justify-center rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-500">
              <span className="size-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#014171]" aria-hidden="true" />
              Restoring your dashboard…
            </div>
          </div>
        ) : !mounted ? (
          <div className="grid gap-3 xl:grid-cols-12">
            {visibleWidgets.map((widget) => <div key={widget.id} className={`min-w-0 ${staticSpan[widget.id]}`}>{widget.content}</div>)}
          </div>
        ) : visibleWidgets.length ? (
          <ResponsiveGridLayout<DashboardBreakpoint>
            width={width}
            layouts={visibleLayouts}
            breakpoints={breakpoints}
            cols={columns}
            rowHeight={rowHeight}
            margin={gridMargin}
            containerPadding={gridContainerPadding}
            compactor={verticalCompactor}
            dragConfig={dragConfig}
            resizeConfig={resizeConfig}
            onBreakpointChange={changeBreakpoint}
            onDragStop={saveChangedLayout}
            onResizeStop={saveChangedLayout}
            className={editing ? "dashboard-grid dashboard-grid--editing" : "dashboard-grid"}
          >
            {visibleWidgets.map((widget) => {
              const mode = modes[widget.id] ?? "normal";
              const compact = mode === "minimized";
              return (
                <div key={widget.id} className={`dashboard-grid-item min-w-0 overflow-hidden ${editing ? "rounded-lg ring-2 ring-[#014171]/15" : ""}`}>
                  {editing && (
                    <div className="dashboard-widget-toolbar absolute inset-x-0 top-0 z-20 flex h-9 items-center gap-1 border-b border-slate-200 bg-slate-50/95 px-2 backdrop-blur">
                      <button type="button" className="dashboard-drag-handle flex min-w-0 flex-1 cursor-grab items-center gap-1.5 text-left text-[10px] font-bold uppercase tracking-[0.07em] text-slate-600 active:cursor-grabbing" aria-label={`Move ${widget.title}`}>
                        <IconGlyph icon={GripVertical} size={14} />
                        <span className="truncate">{widget.title}</span>
                      </button>
                      <WidgetControl label={compact ? "Restore panel" : "Minimize panel"} icon={compact ? Maximize2 : Minimize2} onClick={() => setWidgetMode(widget.id, compact ? "normal" : "minimized")} />
                      <WidgetControl label={mode === "maximized" ? "Restore panel width" : "Maximize panel width"} icon={mode === "maximized" ? Minimize2 : Maximize2} onClick={() => setWidgetMode(widget.id, mode === "maximized" ? "normal" : "maximized")} />
                      <WidgetControl label="Hide panel" icon={EyeOff} onClick={() => toggleWidget(widget.id)} />
                    </div>
                  )}

                  {compact ? (
                    <div className={`flex h-full items-center justify-between gap-3 rounded-lg border border-slate-200 border-t-2 border-t-[#7c3aed] bg-white px-4 shadow-sm ${editing ? "pt-9" : ""}`}>
                      <div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[#4f7fa9]">Minimized</p><p className="truncate text-sm font-bold text-slate-800">{widget.title}</p></div>
                      <button type="button" onClick={() => setWidgetMode(widget.id, "normal")} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-[#014171] transition hover:bg-slate-50"><IconGlyph icon={Maximize2} size={12} /> Expand</button>
                    </div>
                  ) : (
                    <div className={`dashboard-widget-content h-full min-h-0 ${editing ? "dashboard-widget-content--editing pointer-events-none" : ""}`}>{widget.content}</div>
                  )}
                </div>
              );
            })}
          </ResponsiveGridLayout>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
            <p className="text-sm font-bold text-slate-800">All Overview panels are hidden.</p>
            <p className="mt-1 text-xs text-slate-500">Open Customize dashboard, then Panels, to show a section again.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WidgetControl({ label, icon, onClick }: { label: string; icon: Parameters<typeof IconGlyph>[0]["icon"]; onClick: () => void }) {
  return <button type="button" title={label} aria-label={label} onClick={onClick} className="pointer-events-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-white hover:text-[#014171] hover:shadow-sm"><IconGlyph icon={icon} size={13} /></button>;
}

function FloatingControl({ label, displayLabel, icon, onClick, pressed, primary = false }: { label: string; displayLabel: string; icon: Parameters<typeof IconGlyph>[0]["icon"]; onClick: () => void; pressed?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={`inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-xs font-bold transition ${primary ? "bg-[#014171] text-white hover:bg-[#025486]" : pressed ? "bg-slate-100 text-[#014171]" : "text-slate-600 hover:bg-slate-100 hover:text-[#014171]"}`}
    >
      <IconGlyph icon={icon} size={15} />
      <span>{displayLabel}</span>
    </button>
  );
}

function item(i: WidgetId, x: number, y: number, w: number, h: number, minW: number, minH: number): LayoutItem {
  return { i, x, y, w, h, minW, minH };
}

function cloneLayouts(source: ResponsiveLayouts<DashboardBreakpoint>): ResponsiveLayouts<DashboardBreakpoint> {
  return Object.fromEntries(Object.entries(source).map(([key, layout]) => [key, layout?.map((layoutItem) => ({ ...layoutItem })) ?? []])) as ResponsiveLayouts<DashboardBreakpoint>;
}

function buildVisibleLayouts(
  source: ResponsiveLayouts<DashboardBreakpoint>,
  hidden: WidgetId[],
  modes: Partial<Record<WidgetId, WidgetMode>>,
): ResponsiveLayouts<DashboardBreakpoint> {
  return Object.fromEntries(
    (Object.keys(columns) as DashboardBreakpoint[]).map((key) => [
      key,
      (source[key] ?? []).filter((layoutItem) => !hidden.includes(layoutItem.i as WidgetId)).map((layoutItem) => {
        const mode = modes[layoutItem.i as WidgetId] ?? "normal";
        if (mode === "minimized") return { ...layoutItem, h: 2, minH: 2, isResizable: false };
        if (mode === "maximized") return { ...layoutItem, x: 0, w: columns[key] };
        return layoutItem;
      }),
    ]),
  ) as ResponsiveLayouts<DashboardBreakpoint>;
}

function parseStoredDashboard(value: unknown): StoredDashboard | null {
  if (!isRecord(value) || (value.version !== 1 && value.version !== 2) || !isRecord(value.layouts)) return null;
  const needsMovementPlacement = value.version === 1;
  const layouts = cloneLayouts(defaultLayouts);
  for (const key of Object.keys(columns) as DashboardBreakpoint[]) {
    const candidate = value.layouts[key];
    if (!Array.isArray(candidate)) continue;
    const includesInventoryMovement = candidate.some((rawItem) => isRecord(rawItem) && rawItem.i === "movement");
    const savedItems = new Map<string, LayoutItem>();
    for (const rawItem of candidate) {
      if (!isRecord(rawItem) || !isWidgetId(rawItem.i)) continue;
      if (!includesInventoryMovement && rawItem.i === "recent") continue;
      const fallback = layouts[key]?.find((layoutItem) => layoutItem.i === rawItem.i);
      if (!fallback) continue;
      savedItems.set(rawItem.i, sanitizeLayoutItem(rawItem, columns[key], fallback));
    }
    const restoredLayout = (layouts[key] ?? []).map((layoutItem) => savedItems.get(layoutItem.i) ?? layoutItem);
    layouts[key] = needsMovementPlacement ? placeInventoryMovement(restoredLayout, key) : restoredLayout;
  }

  const hidden = Array.isArray(value.hidden) ? value.hidden.filter(isWidgetId) : [];
  const modes: Partial<Record<WidgetId, WidgetMode>> = {};
  if (isRecord(value.modes)) {
    for (const id of widgetIds) {
      const mode = value.modes[id];
      if (needsMovementPlacement && id === "movement") continue;
      if (mode === "normal" || mode === "minimized" || mode === "maximized") modes[id] = mode;
    }
  }
  return { version: 2, layouts, hidden: [...new Set(hidden)], modes };
}

function placeInventoryMovement(layout: Layout, breakpoint: DashboardBreakpoint): Layout {
  const expenses = layout.find((layoutItem) => layoutItem.i === "expenses");
  const inventory = layout.find((layoutItem) => layoutItem.i === "inventory");
  const movement = layout.find((layoutItem) => layoutItem.i === "movement");
  if (!expenses || !inventory || !movement) return layout;

  const gapStart = expenses.x + expenses.w;
  const gapWidth = inventory.x - gapStart;
  if (breakpoint !== "sm" && gapWidth >= (movement.minW ?? 1)) {
    return layout.map((layoutItem) => layoutItem.i === "movement"
      ? { ...layoutItem, x: gapStart, y: expenses.y, w: gapWidth, h: expenses.h }
      : layoutItem);
  }

  const fallback = defaultLayouts[breakpoint]?.find((layoutItem) => layoutItem.i === "movement");
  return fallback
    ? layout.map((layoutItem) => layoutItem.i === "movement" ? { ...fallback } : layoutItem)
    : layout;
}

function sanitizeLayoutItem(value: unknown, colCount: number, fallback: LayoutItem): LayoutItem {
  if (!isRecord(value)) return fallback;
  const w = clampNumber(value.w, fallback.w, 1, colCount);
  const h = clampNumber(value.h, fallback.h, 2, 100);
  const x = clampNumber(value.x, fallback.x, 0, Math.max(0, colCount - w));
  const y = clampNumber(value.y, fallback.y, 0, 10_000);
  return { ...fallback, x, y, w, h };
}

function clampNumber(value: unknown, fallback: number, minimum: number, maximum: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isWidgetId(value: unknown): value is WidgetId {
  return typeof value === "string" && widgetIds.includes(value as WidgetId);
}
