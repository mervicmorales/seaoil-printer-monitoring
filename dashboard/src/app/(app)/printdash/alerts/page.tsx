import Link from "next/link";
import { printerDetailHref } from "@/lib/printer-navigation";
import { sql } from "drizzle-orm";
import {
  BellRing,
  CircleCheckBig,
  Clock3,
  Printer,
  TriangleAlert,
  type IconNode,
} from "lucide";
import { db } from "@/db";
import { Badge, IconGlyph, PageHeader, TableCard } from "@/components/ui";

export const dynamic = "force-dynamic";

type DatabaseTimestamp = Date | string;
type AlertFilter = "active" | "resolved";

type AlertRow = {
  id: number;
  printer_id: number;
  printer_name: string;
  serial_number: string;
  location_name: string | null;
  department_name: string | null;
  agent_name: string | null;
  type: string;
  severity: string;
  message: string;
  started_at: DatabaseTimestamp;
  resolved_at: DatabaseTimestamp | null;
  event_at: DatabaseTimestamp;
};

type AlertSummaryRow = {
  active: number;
  resolved: number;
};

export default async function MonitoringAlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const status: AlertFilter =
    params.status === "resolved" ? "resolved" : "active";
  const statusCondition =
    status === "active"
      ? sql`where printer_alerts.resolved_at is null`
      : sql`where printer_alerts.resolved_at is not null`;
  const alertsReturnTo = status === "resolved"
    ? "/printdash/alerts?status=resolved"
    : "/printdash/alerts";

  const [alertsResult, summaryResult] = await Promise.all([
    db.execute<AlertRow>(sql`
      select
        printer_alerts.id,
        printer_alerts.printer_id,
        coalesce(printers.asset_tag, printers.serial_number) as printer_name,
        printers.serial_number,
        locations.name as location_name,
        departments.name as department_name,
        monitoring_agents.name as agent_name,
        printer_alerts.type,
        printer_alerts.severity,
        printer_alerts.message,
        printer_alerts.started_at,
        printer_alerts.resolved_at,
        greatest(
          printer_alerts.started_at,
          coalesce(printer_alerts.resolved_at, printer_alerts.started_at)
        ) as event_at
      from printer_alerts
      inner join printers on printers.id = printer_alerts.printer_id
      left join locations on locations.id = printers.location_id
      left join departments on departments.id = printers.department_id
      left join monitoring_agents on monitoring_agents.id = printer_alerts.agent_id
      ${statusCondition}
      order by event_at desc, printer_alerts.id desc
      limit 100
    `),
    db.execute<AlertSummaryRow>(sql`
      select
        count(*) filter (where resolved_at is null)::int as active,
        count(*) filter (where resolved_at is not null)::int as resolved
      from printer_alerts
    `),
  ]);
  const summary = summaryResult.rows[0] ?? { active: 0, resolved: 0 };

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader
        title="Monitoring Alerts"
        subtitle="Active and resolved printer monitoring alerts reported by PrintDash agents."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AlertFilterLink
          href="/printdash/alerts?status=active"
          active={status === "active"}
          icon={TriangleAlert}
          label="Active alerts"
          count={summary.active}
          description="Requires attention"
          accent="red"
        />
        <AlertFilterLink
          href="/printdash/alerts?status=resolved"
          active={status === "resolved"}
          icon={CircleCheckBig}
          label="Resolved alerts"
          count={summary.resolved}
          description="Recorded recoveries"
          accent="green"
        />
      </div>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Monitoring activity</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">
            {status === "active" ? "Active alerts" : "Resolved alerts"}
          </h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {alertsResult.rows.length} records
        </span>
      </div>

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {alertsResult.rows.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconGlyph icon={status === "active" ? BellRing : CircleCheckBig} size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-700">
              {`No ${status} monitoring alerts`}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              {status === "active"
                ? "New printer monitoring issues will appear here when reported by a PrintDash agent."
                : "Resolved printer monitoring events will appear here for reference."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 lg:hidden">
              {alertsResult.rows.map((alert) => (
                <AlertCard key={alert.id} alert={alert} returnTo={alertsReturnTo} />
              ))}
            </div>

            <div className="hidden lg:block">
              <table className="w-full min-w-[1120px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[95px]" />
                  <col className="w-[250px]" />
                  <col className="w-[180px]" />
                  <col className="w-[200px]" />
                  <col className="w-[145px]" />
                  <col className="w-[125px]" />
                  <col className="w-[125px]" />
                </colgroup>
                <thead className="bg-slate-50/95 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Alert</th>
                    <th className="px-4 py-3">Printer</th>
                    <th className="px-4 py-3">Location / Department</th>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Resolved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertsResult.rows.map((alert) => (
                    <tr key={alert.id} className="group align-top transition hover:bg-slate-50/70">
                      <td className="px-4 py-4">
                        <Badge color={alert.resolved_at ? "gray" : "red"}>
                          {alert.resolved_at ? "Resolved" : "Active"}
                        </Badge>
                      </td>
                      <td className="px-4 py-4">
                        <Badge color={alertBadgeColor(alert)}>{alertTitle(alert)}</Badge>
                        <p className="mt-2 break-words text-xs leading-5 text-slate-600">
                          {alert.message}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={printerDetailHref(alert.printer_id, alertsReturnTo)}
                          className="font-bold text-[#014171] decoration-[#014171]/30 underline-offset-4 transition hover:underline"
                        >
                          {alert.printer_name}
                        </Link>
                        <p className="mt-1 break-all font-mono text-[11px] font-medium text-slate-500">
                          {alert.serial_number}
                        </p>
                      </td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-slate-700">
                          {alert.location_name ?? "Not assigned"}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          {alert.department_name ?? "Not assigned"}
                        </p>
                      </td>
                      <td className="px-4 py-4 text-slate-600">
                        {alert.agent_name ?? "Not available"}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium leading-5 text-slate-500">
                        {formatDateTime(alert.started_at)}
                      </td>
                      <td className="px-4 py-4 text-xs font-medium leading-5 text-slate-500">
                        {alert.resolved_at ? formatDateTime(alert.resolved_at) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </TableCard>
    </div>
  );
}

function AlertFilterLink({
  href,
  active,
  icon,
  label,
  count,
  description,
  accent,
}: {
  href: string;
  active: boolean;
  icon: IconNode;
  label: string;
  count: number;
  description: string;
  accent: "red" | "green";
}) {
  const accentClasses = accent === "red"
    ? "bg-red-50 text-red-600"
    : "bg-emerald-50 text-emerald-600";

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#014171]/20 ${
        active
          ? "border-[#014171] bg-[#014171] text-white shadow-md"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md"
      }`}
    >
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-white/10 text-white" : accentClasses}`}>
        <IconGlyph icon={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[10px] font-bold uppercase tracking-[0.12em] ${active ? "text-sky-100" : "text-slate-500"}`}>
          {label}
        </span>
        <span className="mt-1 block text-xs font-medium opacity-80">{description}</span>
      </span>
      <span className="shrink-0 text-2xl font-bold tracking-[-0.04em]">{count}</span>
    </Link>
  );
}

function AlertCard({
  alert,
  returnTo,
}: {
  alert: AlertRow;
  returnTo: string;
}) {
  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${alert.resolved_at ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
            <IconGlyph icon={alert.resolved_at ? CircleCheckBig : TriangleAlert} size={17} />
          </span>
          <div className="min-w-0">
            <Badge color={alertBadgeColor(alert)}>{alertTitle(alert)}</Badge>
            <p className="mt-2 text-sm leading-5 text-slate-700">{alert.message}</p>
          </div>
        </div>
        <Badge color={alert.resolved_at ? "gray" : "red"}>
          {alert.resolved_at ? "Resolved" : "Active"}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:grid-cols-2">
        <AlertDetail icon={Printer} label="Printer">
          <Link
            href={printerDetailHref(alert.printer_id, returnTo)}
            className="font-bold text-[#014171] decoration-[#014171]/30 underline-offset-4 hover:underline"
          >
            {alert.printer_name}
          </Link>
          <span className="mt-0.5 block break-all font-mono text-[11px] text-slate-500">{alert.serial_number}</span>
        </AlertDetail>
        <AlertDetail icon={BellRing} label="Assignment">
          <span className="font-semibold text-slate-700">{alert.location_name ?? "Not assigned"}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{alert.department_name ?? "Not assigned"}</span>
        </AlertDetail>
        <AlertDetail icon={Clock3} label="Started">
          {formatDateTime(alert.started_at)}
        </AlertDetail>
        <AlertDetail icon={CircleCheckBig} label="Resolved">
          {alert.resolved_at ? formatDateTime(alert.resolved_at) : "—"}
        </AlertDetail>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Reporting agent: <span className="font-semibold text-slate-700">{alert.agent_name ?? "Not available"}</span>
      </p>
    </article>
  );
}

function AlertDetail({
  icon,
  label,
  children,
}: {
  icon: IconNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-2.5">
      <span className="mt-0.5 text-slate-400"><IconGlyph icon={icon} size={14} /></span>
      <div className="min-w-0 text-xs leading-5 text-slate-600">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function alertTitle(alert: AlertRow) {
  if (alert.resolved_at && alert.type === "printer-offline") return "Printer Recovered";
  if (alert.type === "printer-offline") return "Printer Offline";
  if (alert.type === "printer-recovered") return "Printer Recovered";
  return humanize(alert.type);
}

function alertBadgeColor(
  alert: AlertRow,
): "green" | "yellow" | "red" | "blue" | "gray" | "orange" {
  if (alert.resolved_at || alert.type === "printer-recovered") return "green";
  const severity = alert.severity.toLowerCase();
  if (severity === "critical" || severity === "error") return "red";
  if (severity === "warning") return "yellow";
  return "blue";
}

function humanize(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: DatabaseTimestamp) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}
