"use client";

import { useState } from "react";
import {
  BellRing,
  Droplets,
  History,
  Printer,
  ServerCog,
  UserRoundCheck,
  Wrench,
  type IconNode,
} from "lucide";
import { IconGlyph } from "@/components/ui";
import type { RecentActivityCategory } from "@/lib/recent-activity";

const activityLimits = [5, 10, 15] as const;
type ActivityLimit = (typeof activityLimits)[number];

export type RecentActivityDisplayItem = {
  id: string;
  category: RecentActivityCategory;
  title: string;
  detail: string;
  meta?: string;
  occurredAt: string;
  href: string;
};

const activityStyle: Record<RecentActivityCategory, { icon: IconNode; iconClass: string; surfaceClass: string }> = {
  toner: { icon: Droplets, iconClass: "text-violet-700", surfaceClass: "bg-violet-50" },
  repair: { icon: Wrench, iconClass: "text-amber-700", surfaceClass: "bg-amber-50" },
  alert: { icon: BellRing, iconClass: "text-rose-700", surfaceClass: "bg-rose-50" },
  account: { icon: UserRoundCheck, iconClass: "text-emerald-700", surfaceClass: "bg-emerald-50" },
  printer: { icon: Printer, iconClass: "text-[#014171]", surfaceClass: "bg-sky-50" },
  agent: { icon: ServerCog, iconClass: "text-cyan-700", surfaceClass: "bg-cyan-50" },
};

export default function RecentActivityPanel({ activities, generatedAt }: { activities: RecentActivityDisplayItem[]; generatedAt: string }) {
  const [limit, setLimit] = useState<ActivityLimit>(5);
  const visibleActivities = activities.slice(0, limit);

  return (
    <section aria-labelledby="recent-activity-heading" className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex min-h-[4.25rem] flex-col justify-between gap-3 border-t-2 border-t-[#7c3aed] border-b border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 text-[#014171]"><IconGlyph icon={History} size={16} /></span>
          <div className="min-w-0">
            <h2 id="recent-activity-heading" className="truncate text-sm font-bold text-slate-800">Recent Activity</h2>
            <p className="truncate text-[10px] text-slate-500">Latest meaningful updates from pages you can access</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Number of recent activities to display">
          <span className="px-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-slate-500">Show</span>
          {activityLimits.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={limit === option}
              onClick={() => setLimit(option)}
              className={`min-w-8 rounded-md px-2 py-1 text-[10px] font-bold transition ${limit === option ? "bg-[#014171] text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-[#014171]"}`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
        {visibleActivities.length ? visibleActivities.map((activity) => (
          <RecentActivityEntry key={activity.id} activity={activity} generatedAt={generatedAt} />
        )) : (
          <div className="flex min-h-24 items-center justify-center border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-xs leading-5 text-slate-500">
            No recent activity is available for the pages you can access.
          </div>
        )}
      </div>
    </section>
  );
}

function RecentActivityEntry({ activity, generatedAt }: { activity: RecentActivityDisplayItem; generatedAt: string }) {
  const style = activityStyle[activity.category];
  const occurredAt = new Date(activity.occurredAt);
  const now = new Date(generatedAt);

  return (
    <div className="flex min-w-0 items-center gap-3 px-4 py-2.5">
      <span className={`inline-flex size-8 shrink-0 items-center justify-center rounded-lg ${style.surfaceClass} ${style.iconClass}`}><IconGlyph icon={style.icon} size={15} /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-3">
          <span className="truncate text-[13px] font-bold text-slate-800">{activity.title}</span>
          <time className="shrink-0 text-[10px] font-semibold text-slate-400" dateTime={activity.occurredAt} title={formatDateTime(occurredAt)}>{relativeTime(occurredAt, now)}</time>
        </span>
        <span className="mt-0.5 flex min-w-0 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
          <span className="truncate text-[11px] text-slate-600">{activity.detail}</span>
          {activity.meta && <span className="hidden text-[10px] text-slate-300 sm:inline">•</span>}
          {activity.meta && <span className="truncate text-[10px] text-slate-400">{activity.meta}</span>}
        </span>
      </span>
    </div>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(value);
}

function relativeTime(value: Date, now: Date) {
  const seconds = Math.max(0, Math.round((now.getTime() - value.getTime()) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  return `${Math.floor(seconds / 86_400)}d ago`;
}
