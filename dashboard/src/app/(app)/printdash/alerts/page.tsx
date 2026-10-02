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
import { requireModuleFullAccess } from "@/lib/server-utils";
import PrinterColumnFilter, {
  type PrinterColumnFilterOption,
} from "@/app/(app)/printers/PrinterColumnFilter";

export const dynamic = "force-dynamic";

type DatabaseTimestamp = Date | string;
type AlertFilter = "active" | "resolved";

type AlertRow = {
  id: number;
  printer_id: number;
  model: string | null;
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
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleFullAccess("monitoring_alerts");
  const params = await searchParams;
  const status: AlertFilter =
    firstParam(params.status) === "resolved" ? "resolved" : "active";
  const locationFilters = paramList(params.location);
  const agentFilters = paramList(params.agent);
  const statusCondition =
    status === "active"
      ? sql`where printer_alerts.resolved_at is null`
      : sql`where printer_alerts.resolved_at is not null`;

  const [alertsResult, summaryResult] = await Promise.all([
    db.execute<AlertRow>(sql`
      select
        printer_alerts.id,
        printer_alerts.printer_id,
        printers.model,
        printers.serial_number,
        offices.name as location_name,
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
      left join offices on offices.id = printers.office_id
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
  const locationOptions = uniqueFilterOptions(alertsResult.rows.map((alert) => ({
    value: alert.location_name?.trim() || "__blank__",
    label: alert.location_name?.trim() || "Not assigned",
  })));
  const agentOptions = uniqueFilterOptions(alertsResult.rows.map((alert) => ({
    value: alert.agent_name?.trim() || "__blank__",
    label: alert.agent_name?.trim() || "Not available",
  })));
  const filteredAlerts = alertsResult.rows.filter((alert) => (
    matchesSelected(alert.location_name?.trim() || "__blank__", locationFilters)
    && matchesSelected(alert.agent_name?.trim() || "__blank__", agentFilters)
  ));
  const activeHref = alertStatusHref("active", locationFilters, agentFilters);
  const resolvedHref = alertStatusHref("resolved", locationFilters, agentFilters);
  const alertsReturnTo = alertStatusHref(status, locationFilters, agentFilters);

  return (
    <div className="flex h-[calc(100dvh-103px)] min-h-0 flex-col overflow-hidden sm:h-[calc(100dvh-111px)]">
      <PageHeader
        title="Monitoring Alerts"
        subtitle="Active and resolved printer monitoring alerts reported by PrintDash agents."
      />

      <TableCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 flex-col gap-2.5 border-b border-slate-200 bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Alert status" className="inline-flex w-fit items-center rounded-lg border border-slate-200 bg-slate-50 p-1">
            <AlertFilterLink href={activeHref} active={status === "active"} icon={TriangleAlert} label="Active" count={summary.active} accent="red" />
            <AlertFilterLink href={resolvedHref} active={status === "resolved"} icon={CircleCheckBig} label="Resolved" count={summary.resolved} accent="green" />
          </nav>
          <span className="text-xs font-semibold tabular-nums text-slate-500">
            {filteredAlerts.length === alertsResult.rows.length
              ? `${filteredAlerts.length} records`
              : `${filteredAlerts.length} of ${alertsResult.rows.length} records`}
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {filteredAlerts.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconGlyph icon={status === "active" ? BellRing : CircleCheckBig} size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-700">
              {alertsResult.rows.length === 0 ? `No ${status} monitoring alerts` : "No alerts match the selected filters"}
            </p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
              {alertsResult.rows.length > 0
                ? "Clear or change the Office and Agent filters in the table header."
                : status === "active"
                ? "New printer monitoring issues will appear here when reported by a PrintDash agent."
                : "Resolved printer monitoring events will appear here for reference."}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredAlerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} returnTo={alertsReturnTo} />
              ))}
            </div>

            <div className="hidden lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[8%]" />
                  <col className="w-[22%]" />
                  <col className="w-[16%]" />
                  <col className="w-[19%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[11%]" />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-slate-50/95 text-[10px] font-bold uppercase tracking-[0.05em] text-slate-500 backdrop-blur-sm">
                  <tr>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Alert</th>
                    <th className="px-4 py-3">Model / SN:</th>
                    <th className="px-4 py-2.5">
                      <FilterableHeading label="Office / Department">
                        <PrinterColumnFilter label="Office" paramName="location" options={locationOptions} selectedValues={locationFilters} />
                      </FilterableHeading>
                    </th>
                    <th className="px-4 py-2.5">
                      <FilterableHeading label="Agent">
                        <PrinterColumnFilter label="Agent" paramName="agent" options={agentOptions} selectedValues={agentFilters} />
                      </FilterableHeading>
                    </th>
                    <th className="px-4 py-3">Started</th>
                    <th className="px-4 py-3">Resolved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAlerts.map((alert) => (
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
                          {alert.model ?? "Model unavailable"}
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
        </div>
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
  accent,
}: {
  href: string;
  active: boolean;
  icon: IconNode;
  label: string;
  count: number;
  accent: "red" | "green";
}) {
  const activeClasses = accent === "red"
    ? "bg-white text-red-700 shadow-sm"
    : "bg-white text-emerald-700 shadow-sm";
  const countClasses = accent === "red"
    ? "bg-red-50 text-red-700"
    : "bg-emerald-50 text-emerald-700";

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 min-w-0 items-center gap-2 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#014171]/20 ${active ? activeClasses : "text-slate-500 hover:bg-white hover:text-slate-700"}`}
    >
      <IconGlyph icon={icon} size={14} />
      <span>{label}</span>
      <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${countClasses}`}>{count}</span>
    </Link>
  );
}

function FilterableHeading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="min-w-0 leading-4">{label}</span>
      {children}
    </div>
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
        <AlertDetail icon={Printer} label="Model / SN:">
          <Link
            href={printerDetailHref(alert.printer_id, returnTo)}
            className="font-bold text-[#014171] decoration-[#014171]/30 underline-offset-4 hover:underline"
          >
            {alert.model ?? "Model unavailable"}
          </Link>
          <span className="mt-0.5 block break-all font-mono text-[11px] text-slate-500">{alert.serial_number}</span>
        </AlertDetail>
        <AlertDetail icon={BellRing} label="Office / Department">
          <span className="font-semibold text-slate-700">{alert.location_name ?? "Not assigned"}</span>
          <span className="mt-0.5 block text-xs text-slate-500">{alert.department_name ?? "Not assigned"}</span>
        </AlertDetail>
        <AlertDetail icon={Clock3} label="Started">
          {formatDateTime(alert.started_at)}
        </AlertDetail>
        <AlertDetail icon={CircleCheckBig} label="Resolved">
          {alert.resolved_at ? formatDateTime(alert.resolved_at) : "—"}
        </AlertDetail>
        <AlertDetail icon={BellRing} label="Agent">
          {alert.agent_name ?? "Not available"}
        </AlertDetail>
      </div>
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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function paramList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function matchesSelected(value: string, selected: string[]) {
  return selected.length === 0 || selected.includes(value);
}

function uniqueFilterOptions(options: PrinterColumnFilterOption[]) {
  return [...new Map(options.map((option) => [option.value, option])).values()]
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
}

function alertStatusHref(status: AlertFilter, locations: string[], agents: string[]) {
  const params = new URLSearchParams();
  params.set("status", status);
  locations.forEach((value) => params.append("location", value));
  agents.forEach((value) => params.append("agent", value));
  return `/printdash/alerts?${params.toString()}`;
}
