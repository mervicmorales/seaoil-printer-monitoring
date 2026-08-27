import Link from "next/link";
import { printerDetailHref } from "@/lib/printer-navigation";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { Badge, PageHeader, TableCard } from "@/components/ui";

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

      <div className="mb-4 flex flex-wrap gap-2">
        <AlertFilterLink href="/printdash/alerts?status=active" active={status === "active"}>
          Active ({summary.active})
        </AlertFilterLink>
        <AlertFilterLink href="/printdash/alerts?status=resolved" active={status === "resolved"}>
          Resolved ({summary.resolved})
        </AlertFilterLink>
      </div>

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {alertsResult.rows.length === 0 ? (
          <div className="flex min-h-52 items-center justify-center px-5 text-center text-sm text-slate-500">
            {`No ${status} monitoring alerts.`}
          </div>
        ) : (
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
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                <tr key={alert.id} className="align-top hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <Badge color={alert.resolved_at ? "gray" : "red"}>
                      {alert.resolved_at ? "Resolved" : "Active"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={alertBadgeColor(alert)}>{alertTitle(alert)}</Badge>
                    <p className="mt-2 break-words text-xs leading-5 text-slate-600">
                      {alert.message}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={printerDetailHref(alert.printer_id, alertsReturnTo)}
                      className="font-semibold text-[#014171] hover:underline"
                    >
                      {alert.printer_name}
                    </Link>
                    <p className="mt-1 break-all text-xs text-slate-400">
                      {alert.serial_number}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">
                      {alert.location_name ?? "Not assigned"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {alert.department_name ?? "Not assigned"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {alert.agent_name ?? "Not available"}
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-slate-500">
                    {formatDateTime(alert.started_at)}
                  </td>
                  <td className="px-4 py-3 text-xs leading-5 text-slate-500">
                    {alert.resolved_at ? formatDateTime(alert.resolved_at) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
}

function AlertFilterLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
        active
          ? "bg-[#014171] text-white"
          : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
      }`}
    >
      {children}
    </Link>
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
