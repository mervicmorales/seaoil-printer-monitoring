import {
  Activity,
  AlertTriangle,
  Archive,
  Clock,
  Database,
  PauseCircle,
  RefreshCw,
  ShieldCheck,
  Trash2,
  type IconNode,
} from "lucide";
import { IconGlyph, PageHeader } from "@/components/ui";
import { getMonitoringRetentionStatus } from "@/lib/monitoring-retention-status";
import { requireAdmin } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("en-PH");
const dateTime = new Intl.DateTimeFormat("en-PH", {
  timeZone: "Asia/Manila",
  dateStyle: "medium",
  timeStyle: "short",
});

const healthStyle = {
  healthy: {
    label: "Healthy",
    detail: "The automatic cleanup completed within the expected schedule.",
    icon: ShieldCheck,
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconClassName: "bg-emerald-100 text-emerald-700",
  },
  running: {
    label: "Running",
    detail: "Monitoring history is currently being summarized and cleaned.",
    icon: RefreshCw,
    className: "border-sky-200 bg-sky-50 text-sky-800",
    iconClassName: "bg-sky-100 text-sky-700",
  },
  failed: {
    label: "Failed",
    detail: "The latest retention run failed and needs administrator attention.",
    icon: AlertTriangle,
    className: "border-rose-200 bg-rose-50 text-rose-800",
    iconClassName: "bg-rose-100 text-rose-700",
  },
  waiting: {
    label: "Waiting",
    detail: "No recent successful automatic cleanup has been recorded.",
    icon: Clock,
    className: "border-amber-200 bg-amber-50 text-amber-900",
    iconClassName: "bg-amber-100 text-amber-700",
  },
  disabled: {
    label: "Disabled",
    detail: "Automatic monitoring retention is disabled in the deployment configuration.",
    icon: PauseCircle,
    className: "border-slate-200 bg-slate-50 text-slate-700",
    iconClassName: "bg-slate-200 text-slate-600",
  },
} satisfies Record<string, {
  label: string;
  detail: string;
  icon: IconNode;
  className: string;
  iconClassName: string;
}>;

export default async function DataRetentionPage() {
  await requireAdmin("system");
  const status = await getMonitoringRetentionStatus();
  const health = healthStyle[status.health];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Retention"
        parentTitle="System"
        subtitle="Monitoring history summaries, automatic cleanup health, and database usage."
      />

      <section className={`rounded-xl border p-5 ${health.className}`}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <span className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${health.iconClassName}`}>
              <IconGlyph icon={health.icon} size={24} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.14em]">Retention status</p>
              <h2 className="mt-1 text-xl font-bold">{health.label}</h2>
              <p className="mt-1 text-sm opacity-80">{health.detail}</p>
            </div>
          </div>
          <div className="shrink-0 text-left sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">Next cleanup</p>
            <p className="mt-1 text-sm font-bold">
              {status.nextRun ? dateTime.format(status.nextRun) : "Not scheduled"}
            </p>
          </div>
        </div>
      </section>

      {!status.initialized && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The retention database migration has not been applied. Deploy the latest database initializer before enabling cleanup.
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Database} label="Database size" value={status.databaseSize} detail="PostgreSQL data and indexes" />
        <MetricCard icon={Clock} label="Detailed history" value={`${status.config.rawRetentionDays} days`} detail={`${number.format(status.currentRecords.monitoring)} monitoring readings`} />
        <MetricCard icon={Archive} label="Summary history" value={`${status.config.summaryRetentionDays} days`} detail={`${number.format(status.summaries.hourly + status.summaries.daily)} summary rows`} />
        <MetricCard icon={Activity} label="Open alerts" value={number.format(status.currentRecords.openAlerts)} detail={`${number.format(status.currentRecords.resolvedAlerts)} resolved alerts retained`} />
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader icon={Trash2} title="Latest cleanup" subtitle="Rows handled by the latest retention execution" />
          <div className="grid grid-cols-2 divide-x divide-y divide-slate-200">
            <SummaryMetric label="Hourly summaries written" value={status.latestCounts.hourlyWritten} />
            <SummaryMetric label="Daily summaries written" value={status.latestCounts.dailyWritten} />
            <SummaryMetric label="Monitoring readings deleted" value={status.latestCounts.monitoringDeleted} />
            <SummaryMetric label="Resolved alerts deleted" value={status.latestCounts.alertsDeleted} />
          </div>
          <div className="border-t border-slate-200 px-5 py-4 text-sm text-slate-600">
            <p>
              <span className="font-semibold text-slate-800">Last successful cleanup:</span>{" "}
              {status.latestCompletedAt ? dateTime.format(status.latestCompletedAt) : "None recorded"}
            </p>
            <p className="mt-1">
              <span className="font-semibold text-slate-800">Resolved-alert retention:</span>{" "}
              {status.config.resolvedAlertRetentionDays} days
            </p>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <SectionHeader icon={Archive} title="Stored summaries" subtitle="Compact history retained after detailed readings expire" />
          <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
            <SummaryMetric label="Hourly printer summaries" value={status.summaries.hourly} />
            <SummaryMetric label="Daily consumable summaries" value={status.summaries.daily} />
          </div>
          <div className="grid gap-4 p-5 text-sm text-slate-600 sm:grid-cols-2">
            <Coverage label="Monitoring coverage" start={status.summaries.earliestHourly} end={status.summaries.latestHourly} />
            <Coverage label="Consumable coverage" start={status.summaries.earliestDaily} end={status.summaries.latestDaily} />
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader icon={Clock} title="Recent retention runs" subtitle="Latest automatic cleanup and dry-run results" />
        {status.recentRuns.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Started</th>
                  <th className="px-5 py-3 font-bold">Completed</th>
                  <th className="px-5 py-3 font-bold">Type</th>
                  <th className="px-5 py-3 font-bold">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {status.recentRuns.map((run) => (
                  <tr key={run.id} className="text-slate-600">
                    <td className="px-5 py-3"><RunBadge status={run.status} /></td>
                    <td className="whitespace-nowrap px-5 py-3">{dateTime.format(run.started_at)}</td>
                    <td className="whitespace-nowrap px-5 py-3">{run.completed_at ? dateTime.format(run.completed_at) : "—"}</td>
                    <td className="px-5 py-3">{run.dry_run ? "Dry run" : "Cleanup"}</td>
                    <td className="max-w-md px-5 py-3 text-slate-500">{run.error_message || "Completed without an error message."}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-5 py-10 text-center text-sm text-slate-500">No retention runs have been recorded.</div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ icon, label, value, detail }: { icon: IconNode; label: string; value: string; detail: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#014171]">{value}</p>
        </div>
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#014171]">
          <IconGlyph icon={icon} size={20} />
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{detail}</p>
    </article>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: IconNode; title: string; subtitle: string }) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#014171]">
        <IconGlyph icon={icon} size={18} />
      </span>
      <div>
        <h2 className="font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </header>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-bold text-[#014171]">{number.format(value)}</p>
    </div>
  );
}

function Coverage({ label, start, end }: { label: string; start: Date | string | null; end: Date | string | null }) {
  return (
    <div>
      <p className="font-semibold text-slate-800">{label}</p>
      <p className="mt-1">{start ? formatCoverageValue(start) : "No summaries yet"}</p>
      {start && <p>through {end ? formatCoverageValue(end) : "—"}</p>}
    </div>
  );
}

function formatCoverageValue(value: Date | string) {
  if (value instanceof Date) return dateTime.format(value);
  const date = new Date(`${value}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" }).format(date);
}

function RunBadge({ status }: { status: string }) {
  const className = status === "completed"
    ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
    : status === "failed"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : status === "running"
        ? "bg-sky-50 text-sky-700 ring-sky-200"
        : "bg-amber-50 text-amber-800 ring-amber-200";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ring-inset ${className}`}>{status}</span>;
}
