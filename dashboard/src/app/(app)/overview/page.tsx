import Link from "next/link";
import type { ReactNode } from "react";
import {
  Activity,
  BellRing,
  CheckCircle2,
  Clock3,
  Droplets,
  ExternalLink,
  Package,
  Printer,
  ServerCog,
  Ticket,
  UserRoundCheck,
  Wrench,
  type IconNode,
} from "lucide";
import { and, asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  printers,
  repairTickets,
  tonerInventory,
  tonerTypes,
  userRegistrationRequests,
  users,
} from "@/db/schema";
import RefreshControl from "@/components/RefreshControl";
import { Badge, IconGlyph, PageHeader } from "@/components/ui";
import TonerExpensesPanel from "./TonerExpensesPanel";
import { isAgentOnline } from "@/lib/agent-version";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";
import { parseOverviewScope } from "@/lib/overview-analytics";
import { getOverviewExpenses } from "@/lib/overview-expenses";
import { requireModuleFullAccess } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

const AUTO_REFRESH_SECONDS = 60;
const integer = new Intl.NumberFormat("en-PH");

type SearchParams = Record<string, string | string[] | undefined>;
type MonitoringRow = {
  printer_id: number;
  location_name: string;
  checked_at: Date | null;
  online: boolean | null;
  error_status: string | null;
  error_message: string | null;
  active_alerts: number;
};
type AgentRow = {
  id: number;
  name: string;
  location_name: string;
  stored_status: string;
  last_seen: Date | null;
  token_revoked_at: Date | null;
  assigned_printers: number;
};
export default async function OverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireModuleFullAccess("dashboard");
  const renderedAt = new Date();
  const params = await searchParams;
  const parsedScope = parseOverviewScope(params);
  const scope = { ...parsedScope, locationId: null, departmentId: null };
  const staleSeconds = await getMonitoringStaleSeconds();

  const ticketConditions: SQL[] = [inArray(repairTickets.status, ["Open", "In Progress"])];

  const userConditions: SQL[] = [];
  const registrationConditions: SQL[] = [];
  const [
    printerStatusRows,
    ticketRows,
    monitoringResult,
    agentResult,
    inventoryRows,
    expenses,
    userStatusRows,
    registrationStatusRows,
  ] = await Promise.all([
    db.select({ status: printers.status, count: sql<number>`count(*)::int` }).from(printers).groupBy(printers.status),
    db.select({ count: sql<number>`count(*)::int` }).from(repairTickets).where(and(...ticketConditions)),
    db.execute<MonitoringRow>(sql`
      with latest_readings as (
        select distinct on (printer_id) printer_id, checked_at, online, error_status, error_message
        from printer_monitoring_readings
        order by printer_id, checked_at desc, id desc
      )
      select
        p.id as printer_id,
        coalesce(l.name, 'Unassigned location') as location_name,
        lr.checked_at,
        lr.online,
        lr.error_status,
        lr.error_message,
        coalesce(alerts.active_alerts, 0)::int as active_alerts
      from printers p
      left join locations l on l.id = p.location_id
      left join latest_readings lr on lr.printer_id = p.id
      left join lateral (
        select count(*)::int as active_alerts
        from printer_alerts pa
        where pa.printer_id = p.id and pa.resolved_at is null
      ) alerts on true
      where true
      order by l.name nulls last, p.id
    `),
    db.execute<AgentRow>(sql`
      select
        ma.id,
        ma.name,
        coalesce(primary_location.name, 'Unassigned location') as location_name,
        ma.status as stored_status,
        ma.last_seen,
        ma.token_revoked_at,
        (
          select count(*)::int
          from printer_monitoring_assignments scoped_assignment
          inner join printers scoped_printer on scoped_printer.id = scoped_assignment.printer_id
          where scoped_assignment.agent_id = ma.id
        ) as assigned_printers
      from monitoring_agents ma
      left join locations primary_location on primary_location.id = ma.location_id
      where true
      order by ma.name, ma.id
    `),
    db.select({ id: tonerTypes.id, name: tonerTypes.name, stock: tonerInventory.stock, threshold: tonerInventory.lowStockThreshold, critical: tonerInventory.criticalStockThreshold }).from(tonerTypes).leftJoin(tonerInventory, eq(tonerInventory.tonerTypeId, tonerTypes.id)).where(eq(tonerTypes.showAlertCard, true)).orderBy(asc(tonerTypes.name)),
    getOverviewExpenses(scope.period, renderedAt),
    db.select({ status: users.accountStatus, count: sql<number>`count(*)::int` }).from(users).where(userConditions.length ? and(...userConditions) : undefined).groupBy(users.accountStatus),
    db.select({ status: userRegistrationRequests.status, count: sql<number>`count(*)::int` }).from(userRegistrationRequests).where(registrationConditions.length ? and(...registrationConditions) : undefined).groupBy(userRegistrationRequests.status),
  ]);

  const totalPrinters = printerStatusRows.reduce((sum, row) => sum + row.count, 0);
  const operational = countStatus(printerStatusRows, "Active");
  const underRepair = countStatus(printerStatusRows, "Under Repair");
  const spare = countStatus(printerStatusRows, "Spare");
  const openTickets = ticketRows[0]?.count ?? 0;

  const now = renderedAt;
  const monitoringRows = monitoringResult.rows;
  const monitoredRows = monitoringRows.filter((row) => row.checked_at);
  const isReadingOnline = (row: MonitoringRow) => Boolean(row.online && row.checked_at && now.getTime() - new Date(row.checked_at).getTime() <= staleSeconds * 1_000);
  const onlinePrinters = monitoredRows.filter(isReadingOnline).length;
  const offlinePrinters = monitoredRows.length - onlinePrinters;
  const activeAlerts = monitoringRows.reduce((sum, row) => sum + Number(row.active_alerts ?? 0), 0);
  const warningPrinters = monitoringRows.filter((row) => isReadingOnline(row) && (row.active_alerts > 0 || row.error_status?.trim() || row.error_message?.trim())).length;
  const monitoringByLocation = groupMonitoringByLocation(monitoringRows, isReadingOnline).slice(0, 8);

  const agents = agentResult.rows.map((row) => ({
    ...row,
    online: isAgentOnline({
      storedStatus: row.stored_status,
      lastSeen: row.last_seen ? new Date(row.last_seen) : null,
      tokenRevokedAt: row.token_revoked_at ? new Date(row.token_revoked_at) : null,
      staleSeconds,
      now,
    }),
  })).sort((left, right) => Number(left.online) - Number(right.online) || left.location_name.localeCompare(right.location_name) || left.name.localeCompare(right.name));
  const onlineAgents = agents.filter((agent) => agent.online).length;
  const offlineAgents = agents.length - onlineAgents;

  const inventory = inventoryRows.map((row) => ({ ...row, stock: row.stock ?? 0, threshold: row.threshold ?? 5, critical: row.critical ?? 2 }));
  const onHand = inventory.reduce((sum, row) => sum + row.stock, 0);
  const lowStock = inventory.filter((row) => row.stock <= row.threshold);
  const orderedInventory = [...inventory].sort((left, right) => stockSeverity(right) - stockSeverity(left) || left.stock - right.stock || left.name.localeCompare(right.name));

  const userCounts = new Map(userStatusRows.map((row) => [row.status, row.count]));
  const registrationCounts = new Map(registrationStatusRows.map((row) => [row.status, row.count]));
  const activeAccounts = userCounts.get("active") ?? 0;
  const pendingEmailVerification = (userCounts.get("pending_email") ?? 0) + (registrationCounts.get("pending_email") ?? 0);
  const pendingApproval = registrationCounts.get("pending_admin") ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        subtitle="A consolidated view of fleet health, toner activity, accounts, and live monitoring."
        actions={<RefreshControl refreshedAtLabel={formatDateTime(renderedAt)} intervalSeconds={AUTO_REFRESH_SECONDS} iconOnly />}
      />

      <div className="grid gap-3 xl:grid-cols-12">
        <section aria-labelledby="accounts-heading" className="order-1 flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-5">
          <FlatPanelHeader id="accounts-heading" eyebrow="Access management" title="Account overview" subtitle="Current organization-wide account status" icon={UserRoundCheck} href="/manage/registrations" />
          <div className="grid flex-1 divide-y divide-slate-200 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            <OverviewMetric label="Active accounts" value={activeAccounts} icon={UserRoundCheck} color="text-emerald-700" />
            <OverviewMetric label="Pending verification" value={pendingEmailVerification} icon={Clock3} color="text-amber-700" />
            <OverviewMetric label="Pending approval" value={pendingApproval} icon={CheckCircle2} color="text-[#4f7fa9]" />
          </div>
        </section>

        <section aria-labelledby="fleet-heading" className="order-2 flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-7">
          <FlatPanelHeader
            id="fleet-heading"
            eyebrow="Fleet health"
            title="Printer asset status"
            subtitle="Lifecycle status and open tickets"
            icon={Printer}
          />
          <div className="grid flex-1 grid-cols-2 divide-x divide-y divide-slate-200 sm:grid-cols-5 sm:divide-y-0">
            <OverviewMetric label="Total printers" value={totalPrinters} icon={Printer} color="text-[#014171]" />
            <OverviewMetric label="Operational" value={operational} icon={CheckCircle2} color="text-emerald-700" />
            <OverviewMetric label="Under repair" value={underRepair} icon={Wrench} color="text-amber-700" />
            <OverviewMetric label="Spare units" value={spare} icon={Package} color="text-[#4f7fa9]" />
            <OverviewMetric label="Open tickets" value={openTickets} icon={Ticket} color="text-rose-700" />
          </div>
        </section>

        <TonerExpensesPanel initialData={expenses} initialScope={scope} />

        <section aria-labelledby="inventory-heading" className="order-6 flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-4">
          <FlatPanelHeader id="inventory-heading" eyebrow="Inventory health" title="Toner inventory" subtitle={`${inventory.length} tracked toner types`} icon={Droplets} href="/toner-monitoring" />
          <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
            <MiniMetric label="Units on hand" value={onHand} color="text-[#014171]" />
            <MiniMetric label="Low-stock types" value={lowStock.length} color={lowStock.length ? "text-rose-700" : "text-emerald-700"} />
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-fr divide-y divide-slate-100 overflow-y-auto">{orderedInventory.length ? orderedInventory.map((row) => <StockLevel key={row.id} name={row.name} stock={row.stock} threshold={row.threshold} critical={row.critical} />) : <EmptyMessage>No toner inventory has been configured.</EmptyMessage>}</div>
        </section>

        <section aria-labelledby="agents-heading" className="order-3 flex h-full min-h-[22rem] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-4">
          <FlatPanelHeader id="agents-heading" eyebrow="Agent health" title="Agent locations" subtitle={`${onlineAgents} online · ${offlineAgents} offline`} icon={ServerCog} href="/monitoring-agents" />
          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {agents.length ? agents.slice(0, 10).map((agent) => (
              <div key={agent.id} className="flex items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`size-2 shrink-0 rounded-full ${agent.online ? "bg-emerald-500" : "bg-rose-500"}`} /><p className="truncate text-xs font-bold text-slate-800">{agent.name}</p></div><p className="mt-1 truncate pl-4 text-[10px] text-slate-500">{agent.location_name} · {agent.assigned_printers} printers</p></div><div className="shrink-0 text-right"><Badge color={agent.online ? "green" : "red"}>{agent.online ? "Online" : "Offline"}</Badge><p className="mt-1 text-[9px] text-slate-400">{agent.last_seen ? relativeTime(agent.last_seen, now) : "Never seen"}</p></div></div>
            )) : <EmptyMessage>No monitoring agents are available.</EmptyMessage>}
          </div>
        </section>

        <section aria-labelledby="monitoring-heading" className="order-4 flex h-full min-h-[22rem] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-8">
          <FlatPanelHeader id="monitoring-heading" eyebrow="Live operations" title="Printer connectivity by location" subtitle={`${integer.format(monitoredRows.length)} monitored · ${integer.format(monitoringRows.length - monitoredRows.length)} without readings`} icon={Activity} href="/printers" />
          <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200 sm:grid-cols-4">
            <MiniMetric label="Online" value={onlinePrinters} color="text-emerald-700" /><MiniMetric label="Offline" value={offlinePrinters} color="text-rose-700" /><MiniMetric label="Warning" value={warningPrinters} color="text-amber-700" /><MiniMetric label="Active alerts" value={activeAlerts} color="text-violet-700" />
          </div>
          <div className="max-h-[22rem] flex-1 space-y-4 overflow-y-auto p-4">{monitoringByLocation.length ? monitoringByLocation.map((row) => <ConnectivityBar key={row.name} {...row} />) : <EmptyMessage>No monitoring data is available.</EmptyMessage>}</div>
        </section>
      </div>
    </div>
  );
}

function FlatPanelHeader({ id, eyebrow, title, subtitle, icon, href, meta, actions }: { id: string; eyebrow: string; title: string; subtitle: string; icon: IconNode; href?: string; meta?: string; actions?: ReactNode }) {
  return <div className="flex min-h-[4.25rem] flex-col justify-between gap-3 border-t-2 border-t-[#7c3aed] border-b border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-2.5"><span className="shrink-0 text-[#014171]"><IconGlyph icon={icon} size={16} /></span><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#4f7fa9]">{eyebrow}</p>{meta && <span className="truncate text-[9px] text-slate-400">· {meta}</span>}</div><h2 id={id} className="truncate text-sm font-bold text-slate-800">{title}</h2><p className="truncate text-[10px] text-slate-500">{subtitle}</p></div></div><div className="shrink-0">{actions ?? (href && <Link href={href} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0b70a8] hover:text-[#014171]">View details <IconGlyph icon={ExternalLink} size={10} /></Link>)}</div></div>;
}

function OverviewMetric({ label, value, icon, color }: { label: string; value: number; icon: IconNode; color: string }) {
  return <div className="flex min-h-[5.75rem] items-center justify-between gap-3 px-4 py-3"><div className="min-w-0"><p className="min-h-8 text-[9px] font-bold uppercase leading-4 tracking-[0.06em] text-slate-500">{label}</p><p className={`mt-1 text-2xl font-bold tabular-nums ${color}`}>{integer.format(value)}</p></div><span className={`${color} shrink-0 opacity-60`}><IconGlyph icon={icon} size={18} /></span></div>;
}

function MiniMetric({ label, value, color }: { label: string; value: number; color: string }) { return <div className="bg-white px-4 py-2.5"><p className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500">{label}</p><p className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}>{integer.format(value)}</p></div>; }
function EmptyMessage({ children }: { children: ReactNode }) { return <div className="flex min-h-24 items-center justify-center border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-xs leading-5 text-slate-500">{children}</div>; }

function ConnectivityBar({ name, online, offline, alerts }: { name: string; online: number; offline: number; alerts: number }) {
  const total = online + offline;
  return <div><div className="mb-2 flex items-center justify-between gap-3"><p className="truncate text-xs font-bold text-slate-700">{name}</p><div className="flex shrink-0 items-center gap-3 text-[11px]"><span className="text-emerald-700">{online} online</span><span className="text-rose-700">{offline} offline</span>{alerts > 0 && <span className="inline-flex items-center gap-1 font-bold text-violet-700"><IconGlyph icon={BellRing} size={11} />{alerts}</span>}</div></div><div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100"><span className="bg-emerald-500" style={{ width: `${percentage(online, total)}%` }} /><span className="bg-rose-500" style={{ width: `${percentage(offline, total)}%` }} /></div></div>;
}

function StockLevel({ name, stock, threshold, critical }: { name: string; stock: number; threshold: number; critical: number }) {
  const state = stock <= 0 ? "empty" : stock <= critical ? "critical" : stock <= threshold ? "low" : "healthy";
  const styles = {
    empty: { row: "bg-rose-50", badge: "bg-rose-100 text-rose-800", bar: "bg-rose-600", label: "Out of stock" },
    critical: { row: "bg-rose-50/60", badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500", label: "Critical" },
    low: { row: "bg-amber-50/60", badge: "bg-amber-100 text-amber-800", bar: "bg-amber-500", label: "Low" },
    healthy: { row: "bg-white", badge: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", label: "Healthy" },
  }[state];
  const fill = Math.min(100, percentage(stock, Math.max(threshold * 2, 1)));
  return <div className={`flex flex-col justify-center px-4 py-2.5 ${styles.row}`}><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{name}</p><p className="mt-0.5 text-[9px] text-slate-500">Critical {critical} · Low {threshold}</p></div><div className="flex shrink-0 items-center gap-2"><p className="text-sm font-bold tabular-nums text-[#014171]">{integer.format(stock)}</p><span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.05em] ${styles.badge}`}>{styles.label}</span></div></div><div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/80"><div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${fill}%` }} /></div></div>;
}

function countStatus(rows: { status: string; count: number }[], status: string) { return rows.find((row) => row.status === status)?.count ?? 0; }
function percentage(value: number, total: number) { return total > 0 ? Math.max(0, Math.min(100, Math.round((value / total) * 100))) : 0; }

function groupMonitoringByLocation(rows: MonitoringRow[], online: (row: MonitoringRow) => boolean) {
  const groups = new Map<string, { name: string; online: number; offline: number; alerts: number }>();
  for (const row of rows) {
    if (!row.checked_at) continue;
    const group = groups.get(row.location_name) ?? { name: row.location_name, online: 0, offline: 0, alerts: 0 };
    if (online(row)) group.online += 1; else group.offline += 1;
    group.alerts += Number(row.active_alerts ?? 0);
    groups.set(row.location_name, group);
  }
  return [...groups.values()].sort((left, right) => (right.online + right.offline) - (left.online + left.offline) || left.name.localeCompare(right.name));
}

function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(value); }
function relativeTime(value: Date, now: Date) { const seconds = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 1_000)); if (seconds < 60) return `${seconds}s ago`; if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`; return `${Math.floor(seconds / 86_400)}d ago`; }

function stockSeverity(row: { stock: number; threshold: number; critical: number }) { return row.stock <= 0 ? 3 : row.stock <= row.critical ? 2 : row.stock <= row.threshold ? 1 : 0; }
