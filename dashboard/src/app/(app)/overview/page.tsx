import Link from "next/link";
import type { ReactNode } from "react";
import {
  Droplets,
  ExternalLink,
  Printer,
  UserRoundCheck,
  type IconNode,
} from "lucide";
import { and, asc, eq, gte, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  printers,
  repairTickets,
  tonerInventory,
  tonerTransactions,
  tonerTypes,
  userRegistrationRequests,
  users,
} from "@/db/schema";
import RefreshControl from "@/components/RefreshControl";
import { IconGlyph, PageHeader } from "@/components/ui";
import AnimatedNumber from "@/components/ui/AnimatedNumber";
import TonerExpensesPanel from "./TonerExpensesPanel";
import CustomizableDashboard, { type DashboardWidget } from "./CustomizableDashboard";
import RecentActivityPanel from "./RecentActivityPanel";
import AgentOperationsPanel, { type AgentOperationsAgent, type AgentPrinterStatus } from "./AgentOperationsPanel";
import InventoryMovementPanel from "./InventoryMovementPanel";
import FleetHealthVisual from "./FleetHealthVisual";
import { isAgentOnline } from "@/lib/agent-version";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";
import { parseOverviewScope } from "@/lib/overview-analytics";
import { getOverviewExpenses } from "@/lib/overview-expenses";
import { getRecentActivities } from "@/lib/recent-activity";
import { hasAdminPrivileges } from "@/lib/roles";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";
import { buildStockTrend } from "@/lib/toner-inventory-trend";

export const dynamic = "force-dynamic";

const AUTO_REFRESH_SECONDS = 60;
const integer = new Intl.NumberFormat("en-PH");

type SearchParams = Record<string, string | string[] | undefined>;
type MonitoringRow = {
  printer_id: number;
  serial_number: string;
  department_name: string;
  floor: string | null;
  location_name: string;
  agent_id: number | null;
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
};
export default async function OverviewPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireModuleFullAccess("dashboard");
  const moduleAccess = await getModuleAccessMap(session.id, session.role);
  const canManageAgents = hasAdminPrivileges(session.role);
  const renderedAt = new Date();
  const inventoryMovementDays = recentDayKeys(renderedAt, 90);
  const inventoryTrendDays = inventoryMovementDays.slice(-30);
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
    inventoryMovementRows,
    expenses,
    userStatusRows,
    registrationStatusRows,
    recentActivities,
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
        p.serial_number,
        coalesce(d.name, 'Unassigned department') as department_name,
        p.floor,
        coalesce(l.name, 'Unassigned office') as location_name,
        pma.agent_id,
        lr.checked_at,
        lr.online,
        lr.error_status,
        lr.error_message,
        coalesce(alerts.active_alerts, 0)::int as active_alerts
      from printers p
      left join offices l on l.id = p.office_id
      left join departments d on d.id = p.department_id
      left join printer_monitoring_assignments pma on pma.printer_id = p.id
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
        coalesce(primary_office.name, 'Unassigned office') as location_name,
        ma.status as stored_status,
        ma.last_seen,
        ma.token_revoked_at
      from monitoring_agents ma
      left join offices primary_office on primary_office.id = ma.office_id
      where true
      order by ma.name, ma.id
    `),
    db.select({ id: tonerTypes.id, name: tonerTypes.name, stock: tonerInventory.stock, threshold: tonerInventory.lowStockThreshold, critical: tonerInventory.criticalStockThreshold }).from(tonerTypes).leftJoin(tonerInventory, eq(tonerInventory.tonerTypeId, tonerTypes.id)).where(eq(tonerTypes.showAlertCard, true)).orderBy(asc(tonerTypes.name)),
    db.select({ tonerTypeId: tonerTransactions.tonerTypeId, type: tonerTransactions.type, date: tonerTransactions.date, quantity: tonerTransactions.quantity }).from(tonerTransactions).where(gte(tonerTransactions.date, inventoryMovementDays[0]!)).orderBy(asc(tonerTransactions.date), asc(tonerTransactions.id)),
    getOverviewExpenses(scope.period, renderedAt),
    db.select({ status: users.accountStatus, count: sql<number>`count(*)::int` }).from(users).where(userConditions.length ? and(...userConditions) : undefined).groupBy(users.accountStatus),
    db.select({ status: userRegistrationRequests.status, count: sql<number>`count(*)::int` }).from(userRegistrationRequests).where(registrationConditions.length ? and(...registrationConditions) : undefined).groupBy(userRegistrationRequests.status),
    getRecentActivities(moduleAccess, canManageAgents, 15),
  ]);

  const totalPrinters = printerStatusRows.reduce((sum, row) => sum + row.count, 0);
  const operational = countStatus(printerStatusRows, "Active");
  const underRepair = countStatus(printerStatusRows, "Under Repair");
  const spare = countStatus(printerStatusRows, "Spare");
  const openTickets = ticketRows[0]?.count ?? 0;

  const now = renderedAt;
  const monitoringRows = monitoringResult.rows;
  const isReadingOnline = (row: MonitoringRow) => Boolean(row.online && row.checked_at && now.getTime() - new Date(row.checked_at).getTime() <= staleSeconds * 1_000);

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
  const operationAgents: AgentOperationsAgent[] = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    office: agent.location_name,
    online: agent.online,
    lastSeenLabel: agent.last_seen ? relativeTime(agent.last_seen, now) : "Never seen",
    printers: monitoringRows.filter((row) => row.agent_id === agent.id).map((row) => {
      const readingOnline = isReadingOnline(row);
      const warning = readingOnline && Boolean(row.active_alerts > 0 || row.error_status?.trim() || row.error_message?.trim());
      const status: AgentPrinterStatus = !row.checked_at ? "unread" : warning ? "warning" : readingOnline ? "online" : "offline";
      return {
        id: row.printer_id,
        department: row.department_name,
        serialNumber: row.serial_number,
        office: officeWithFloor(row.location_name, row.floor),
        status,
        activeAlerts: Number(row.active_alerts ?? 0),
        statusDetail: row.error_status?.trim() || row.error_message?.trim() || undefined,
      };
    }),
  }));

  const inventoryMovements = new Map<number, typeof inventoryMovementRows>();
  for (const movement of inventoryMovementRows) {
    inventoryMovements.set(movement.tonerTypeId, [...(inventoryMovements.get(movement.tonerTypeId) ?? []), movement]);
  }
  const inventory = inventoryRows.map((row) => {
    const stock = row.stock ?? 0;
    return {
      ...row,
      stock,
      threshold: row.threshold ?? 5,
      critical: row.critical ?? 2,
      trend: buildStockTrend(stock, inventoryTrendDays, inventoryMovements.get(row.id) ?? []),
    };
  });
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
        parentTitle="Overview"
        title="Overview"
        subtitle="A consolidated view of fleet health, toner activity, accounts, and live monitoring."
        actions={<RefreshControl refreshedAtLabel={formatDateTime(renderedAt)} intervalSeconds={AUTO_REFRESH_SECONDS} iconOnly />}
      />

      <CustomizableDashboard
        storageKey={`seaoil-overview-dashboard-v1-user-${session.id}`}
        widgets={[
          { id: "accounts", title: "Account overview", content: (
        <section aria-labelledby="accounts-heading" className="order-1 flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-5">
          <FlatPanelHeader id="accounts-heading" eyebrow="Access management" title="Account overview" subtitle="Current organization-wide account status" icon={UserRoundCheck} href="/manage/registrations" />
          <AccountStatusVisual active={activeAccounts} pendingVerification={pendingEmailVerification} pendingApproval={pendingApproval} />
        </section>
          ) },

          { id: "fleet", title: "Printer asset status", content: (
        <section aria-labelledby="fleet-heading" className="@container order-2 flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-7">
          <FlatPanelHeader
            id="fleet-heading"
            eyebrow="Fleet health"
            title="Printer asset status"
            subtitle="Lifecycle status and open tickets"
            icon={Printer}
          />
          <FleetHealthVisual total={totalPrinters} operational={operational} underRepair={underRepair} spare={spare} openTickets={openTickets} />
        </section>
          ) },

          { id: "expenses", title: "Toner expenses", content: <TonerExpensesPanel initialData={expenses} initialScope={scope} /> },

          { id: "inventory", title: "Toner inventory", content: (
        <section aria-labelledby="inventory-heading" className="order-6 flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-4">
          <FlatPanelHeader id="inventory-heading" eyebrow="Inventory health" title="Toner inventory" subtitle={`${inventory.length} tracked toner types`} icon={Droplets} href="/toner-monitoring" />
          <div className="grid grid-cols-2 divide-x divide-slate-200 border-b border-slate-200">
            <MiniMetric label="Units on hand" value={onHand} color="text-[#014171]" />
            <MiniMetric label="Low-stock types" value={lowStock.length} color={lowStock.length ? "text-rose-700" : "text-emerald-700"} />
          </div>
          <div className="grid min-h-0 flex-1 auto-rows-fr divide-y divide-slate-100 overflow-y-auto">{orderedInventory.length ? orderedInventory.map((row) => <StockLevel key={row.id} name={row.name} stock={row.stock} threshold={row.threshold} critical={row.critical} trend={row.trend} />) : <EmptyMessage>No toner inventory has been configured.</EmptyMessage>}</div>
        </section>
          ) },

          { id: "operations", title: "Agent offices and printer connectivity", content: <AgentOperationsPanel agents={operationAgents} /> },

          { id: "movement", title: "Inventory movement", content: <InventoryMovementPanel currentStock={onHand} today={manilaDateKey(renderedAt)} movements={inventoryMovementRows.map((row) => ({ date: row.date, type: row.type, quantity: row.quantity }))} /> },

          { id: "recent", title: "Recent activity", content: <RecentActivityPanel activities={recentActivities.map((activity) => ({ ...activity, occurredAt: activity.occurredAt.toISOString() }))} generatedAt={now.toISOString()} /> },
        ] satisfies DashboardWidget[]}
      />
    </div>
  );
}

function FlatPanelHeader({ id, eyebrow, title, subtitle, icon, href, meta, actions }: { id: string; eyebrow: string; title: string; subtitle: string; icon: IconNode; href?: string; meta?: string; actions?: ReactNode }) {
  return <div className="flex min-h-[4.25rem] flex-col justify-between gap-3 border-t-2 border-t-[#7c3aed] border-b border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-2.5"><span className="shrink-0 text-[#014171]"><IconGlyph icon={icon} size={16} /></span><div className="min-w-0"><div className="flex items-center gap-2"><p className="text-[9px] font-bold uppercase tracking-[0.13em] text-[#4f7fa9]">{eyebrow}</p>{meta && <span className="truncate text-[9px] text-slate-400">· {meta}</span>}</div><h2 id={id} className="truncate text-sm font-bold text-slate-800">{title}</h2><p className="truncate text-[10px] text-slate-500">{subtitle}</p></div></div><div className="shrink-0">{actions ?? (href && <Link href={href} className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0b70a8] hover:text-[#014171]">View details <IconGlyph icon={ExternalLink} size={10} /></Link>)}</div></div>;
}

function AccountStatusVisual({ active, pendingVerification, pendingApproval }: { active: number; pendingVerification: number; pendingApproval: number }) {
  const values = [
    { label: "Active", value: active, bar: "bg-emerald-500", dot: "bg-emerald-500", valueClass: "text-emerald-700" },
    { label: "Pending verification", value: pendingVerification, bar: "bg-amber-400", dot: "bg-amber-400", valueClass: "text-amber-700" },
    { label: "Pending approval", value: pendingApproval, bar: "bg-sky-500", dot: "bg-sky-500", valueClass: "text-[#4f7fa9]" },
  ];
  const total = values.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-1 flex-col justify-center px-4 py-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${active} active accounts, ${pendingVerification} pending verification, ${pendingApproval} pending approval`}>
        {total > 0 ? values.filter((item) => item.value > 0).map((item) => (
          <span key={item.label} className={`${item.bar} min-w-1`} style={{ flexBasis: 0, flexGrow: item.value }} title={`${item.label}: ${item.value}`} />
        )) : <span className="w-full bg-slate-200" />}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {values.map((item) => (
          <div key={item.label} className="min-w-0">
            <p className="flex min-h-7 items-start gap-1.5 text-[8px] font-bold uppercase leading-3 tracking-[0.05em] text-slate-500"><span className={`mt-1 size-1.5 shrink-0 rounded-full ${item.dot}`} />{item.label}</p>
            <p className={`mt-0.5 text-xl font-bold tabular-nums ${item.valueClass}`}><AnimatedNumber value={item.value} /></p>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniMetric({ label, value, color }: { label: string; value: number; color: string }) { return <div className="bg-white px-4 py-2.5"><p className="text-[9px] font-bold uppercase tracking-[0.07em] text-slate-500">{label}</p><p className={`mt-0.5 text-lg font-bold tabular-nums ${color}`}><AnimatedNumber value={value} /></p></div>; }
function EmptyMessage({ children }: { children: ReactNode }) { return <div className="flex min-h-24 items-center justify-center border border-dashed border-slate-200 bg-slate-50/70 px-5 text-center text-xs leading-5 text-slate-500">{children}</div>; }

function StockLevel({ name, stock, threshold, critical, trend }: { name: string; stock: number; threshold: number; critical: number; trend: number[] }) {
  const state = stock <= 0 ? "empty" : stock <= critical ? "critical" : stock <= threshold ? "low" : "healthy";
  const styles = {
    empty: { row: "bg-rose-50", badge: "bg-rose-100 text-rose-800", bar: "bg-rose-600", trend: "text-rose-600", label: "Out of stock" },
    critical: { row: "bg-rose-50/60", badge: "bg-rose-100 text-rose-700", bar: "bg-rose-500", trend: "text-rose-500", label: "Critical" },
    low: { row: "bg-amber-50/60", badge: "bg-amber-100 text-amber-800", bar: "bg-amber-500", trend: "text-amber-600", label: "Low" },
    healthy: { row: "bg-white", badge: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-500", trend: "text-[#0b70a8]", label: "Healthy" },
  }[state];
  const scaleMaximum = Math.max(stock * 1.15, threshold * 1.75, critical * 2, 1);
  const fill = Math.min(100, (stock / scaleMaximum) * 100);

  return (
    <div className={`flex flex-col justify-center px-4 py-2.5 ${styles.row}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0"><p className="truncate text-xs font-bold text-slate-800">{name}</p><p className="mt-0.5 text-[9px] text-slate-500">Critical {critical} · Low {threshold}</p></div>
        <div className="flex shrink-0 items-center gap-2.5">
          <StockSparkline values={trend} label={`${name} inventory during the last 30 days`} className={styles.trend} />
          <div className="text-right"><p className="text-sm font-bold tabular-nums text-[#014171]">{integer.format(stock)}</p><span className={`inline-flex rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.05em] ${styles.badge}`}>{styles.label}</span></div>
        </div>
      </div>
      <div className="relative mt-2 h-2.5 rounded-full bg-white/90 ring-1 ring-inset ring-slate-200" role="img" aria-label={`${name}: ${stock} units on hand, critical at ${critical}, low at ${threshold}`}>
        <span className={`absolute inset-y-0 left-0 rounded-full ${styles.bar}`} style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function StockSparkline({ values, label, className }: { values: number[]; label: string; className: string }) {
  const width = 76;
  const height = 28;
  const inset = 2;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(1, maximum - minimum);
  const points = values.map((value, index) => {
    const x = inset + (index / Math.max(1, values.length - 1)) * (width - inset * 2);
    const y = height - inset - ((value - minimum) / range) * (height - inset * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const latestPoint = points.split(" ").at(-1)?.split(",") ?? [width - inset, height / 2];

  return (
    <div className={`w-14 sm:w-[4.75rem] ${className}`} role="img" aria-label={`${label}. Started at ${values[0] ?? 0} units and ended at ${values.at(-1) ?? 0} units.`}>
      <p className="mb-0.5 text-right text-[7px] font-bold uppercase tracking-[0.08em] text-slate-400">30d trend</p>
      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="h-7 w-full overflow-visible">
        <line x1={inset} y1={height - inset} x2={width - inset} y2={height - inset} stroke="currentColor" strokeOpacity="0.14" strokeWidth="1" />
        <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={latestPoint[0]} cy={latestPoint[1]} r="2.4" fill="currentColor" />
      </svg>
    </div>
  );
}

function countStatus(rows: { status: string; count: number }[], status: string) { return rows.find((row) => row.status === status)?.count ?? 0; }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(value); }
function relativeTime(value: Date, now: Date) { const seconds = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 1_000)); if (seconds < 60) return `${seconds}s ago`; if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`; return `${Math.floor(seconds / 86_400)}d ago`; }

function stockSeverity(row: { stock: number; threshold: number; critical: number }) { return row.stock <= 0 ? 3 : row.stock <= row.critical ? 2 : row.stock <= row.threshold ? 1 : 0; }

function recentDayKeys(now: Date, count: number) {
  const current = new Date(`${manilaDateKey(now)}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(current);
    day.setUTCDate(current.getUTCDate() - (count - index - 1));
    return day.toISOString().slice(0, 10);
  });
}

function manilaDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function officeWithFloor(office: string, floor: string | null) {
  const normalizedFloor = floor?.trim();
  if (!normalizedFloor || office.toLowerCase().includes(normalizedFloor.toLowerCase())) return office;
  return `${office} - ${normalizedFloor}`;
}
