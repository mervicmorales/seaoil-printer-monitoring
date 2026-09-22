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
import { and, asc, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  locations,
  printers,
  repairTickets,
  tonerInventory,
  tonerTransactions,
  tonerTypes,
  userRegistrationRequests,
  users,
} from "@/db/schema";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import RefreshControl from "@/components/RefreshControl";
import { Badge, IconGlyph, PageHeader } from "@/components/ui";
import { isAgentOnline } from "@/lib/agent-version";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";
import {
  parseOverviewScope,
  resolveOverviewPeriod,
  sortExpenseRows,
  yearlyExpenseSeries,
  type OverviewExpenseBreakdown,
} from "@/lib/overview-analytics";
import { amountToCents, summarizeTonerExpenses, type ExpenseBreakdown } from "@/lib/toner-expenses";

export const dynamic = "force-dynamic";

const AUTO_REFRESH_SECONDS = 60;
const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0 });
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
  const renderedAt = new Date();
  const params = await searchParams;
  const parsedScope = parseOverviewScope(params);
  const scope = { ...parsedScope, locationId: null, departmentId: null };
  const today = manilaDate(renderedAt);
  const period = resolveOverviewPeriod(scope.period, today);
  const staleSeconds = await getMonitoringStaleSeconds();

  const ticketConditions: SQL[] = [inArray(repairTickets.status, ["Open", "In Progress"])];

  const tonerConditions: SQL[] = [eq(tonerTransactions.type, "Request")];
  if (period.fromDate) tonerConditions.push(gte(tonerTransactions.date, period.fromDate));
  tonerConditions.push(lte(tonerTransactions.date, period.toDate));

  const userConditions: SQL[] = [];
  const registrationConditions: SQL[] = [];
  const [
    printerStatusRows,
    ticketRows,
    monitoringResult,
    agentResult,
    inventoryRows,
    tonerRequestRows,
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
    db.select({
      date: tonerTransactions.date,
      departmentId: tonerTransactions.departmentId,
      departmentName: departments.name,
      locationId: tonerTransactions.locationId,
      locationName: locations.name,
      tonerTypeId: tonerTransactions.tonerTypeId,
      tonerTypeName: tonerTypes.name,
      unitCost: tonerTypes.unitCost,
      quantity: tonerTransactions.quantity,
    }).from(tonerTransactions).innerJoin(tonerTypes, eq(tonerTransactions.tonerTypeId, tonerTypes.id)).leftJoin(departments, eq(tonerTransactions.departmentId, departments.id)).leftJoin(locations, eq(tonerTransactions.locationId, locations.id)).where(and(...tonerConditions)),
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

  const expenseSummary = summarizeTonerExpenses(tonerRequestRows.map((row) => ({
    date: row.date,
    departmentId: row.departmentId,
    departmentName: row.departmentName,
    locationId: row.locationId,
    locationName: row.locationName,
    tonerTypeId: row.tonerTypeId,
    tonerTypeName: row.tonerTypeName,
    quantity: row.quantity,
    unitCostCents: amountToCents(row.unitCost),
  })));
  const expenseRows = sortExpenseRows(expenseBreakdown(expenseSummary, scope.expenseBreakdown), scope.expenseSort).slice(0, 8);
  const expenseTrend = scope.expenseGrain === "yearly" ? yearlyExpenseSeries(expenseSummary.months) : expenseSummary.months.slice(-12);

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

        <section aria-labelledby="expense-heading" className="order-5 flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)] xl:col-span-8">
          <FlatPanelHeader id="expense-heading" eyebrow="Cost analytics" title="Toner expenses" subtitle="Requested quantity × current configured unit cost" icon={Droplets} href="/toner-expenses" meta={period.label} />
          <div className="grid gap-4 border-b border-slate-200 bg-slate-50/60 px-4 py-3 lg:grid-cols-[minmax(10rem,0.7fr)_minmax(0,2fr)] lg:items-end">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">Estimated expense</p><p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-[#014171]">{money.format(expenseSummary.totalExpenseCents / 100)}</p><p className="mt-0.5 text-[10px] text-slate-500">{integer.format(expenseSummary.totalUnits)} units · {integer.format(expenseSummary.requestLines)} request records</p></div>
            <AutoSubmitFilterForm method="get" className="grid min-w-0 gap-2 sm:grid-cols-2" resetKey={`${scope.period}-${scope.expenseGrain}-${scope.expenseBreakdown}-${scope.expenseSort}`}>
              <SmallSelect name="period" label="Reporting period" value={scope.period} options={[{ value: "30d", label: "Last 30 days" }, { value: "90d", label: "Last 90 days" }, { value: "12m", label: "Last 12 months" }, { value: "ytd", label: "Year to date" }, { value: "all", label: "All activity" }]} />
              <SmallSelect name="expenseGrain" label="Trend" value={scope.expenseGrain} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />
              <SmallSelect name="expenseBreakdown" label="Rank by" value={scope.expenseBreakdown} options={[{ value: "toner", label: "Toner type" }, { value: "location", label: "Location" }, { value: "department", label: "Department" }]} />
              <SmallSelect name="expenseSort" label="Order" value={scope.expenseSort} options={[{ value: "desc", label: "Highest first" }, { value: "asc", label: "Lowest first" }]} />
            </AutoSubmitFilterForm>
          </div>
          <div className="grid flex-1 lg:grid-cols-2">
            <div className="flex flex-col border-b border-slate-200 p-4 lg:border-r lg:border-b-0"><h3 className="text-xs font-bold text-slate-800">{scope.expenseGrain === "monthly" ? "Monthly" : "Yearly"} expense trend</h3><p className="mt-0.5 text-[10px] text-slate-500">Amount within the selected reporting period</p><ColumnChart rows={expenseTrend} /></div>
            <div className="p-4"><h3 className="text-xs font-bold text-slate-800">Expense by {breakdownLabel(scope.expenseBreakdown).toLowerCase()}</h3><p className="mt-0.5 text-[10px] text-slate-500">{scope.expenseSort === "asc" ? "Lowest to highest" : "Highest to lowest"} estimated amount</p><div className="mt-4 space-y-3">{expenseRows.length ? expenseRows.map((row, index) => <RankBar key={row.key} rank={index + 1} label={row.name} value={row.expenseCents} max={Math.max(...expenseRows.map((item) => item.expenseCents), 1)} formatted={money.format(row.expenseCents / 100)} color="#7c3aed" />) : <EmptyMessage>No expense records match this scope.</EmptyMessage>}</div></div>
          </div>
        </section>

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

const selectClassName = "h-8 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700 outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/10";

function SmallSelect({ name, label, value, options }: { name: string; label: string; value: string; options: { value: string; label: string }[] }) {
  return <label className="min-w-0"><span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.07em] text-slate-500">{label}</span><select name={name} defaultValue={value} className={selectClassName}>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
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

function RankBar({ rank, label, value, max, formatted, color = "#0b70a8" }: { rank: number; label: string; value: number; max: number; formatted: string; color?: string }) {
  return <div><div className="flex items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-2"><span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-500">{rank}</span><p className="truncate text-xs font-bold text-slate-700" title={label}>{label}</p></div><p className="shrink-0 text-xs font-bold tabular-nums text-[#014171]">{formatted}</p></div><div className="mt-2 ml-7 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${percentage(value, max)}%`, backgroundColor: color }} /></div></div>;
}

function ColumnChart({ rows }: { rows: ExpenseBreakdown[] }) {
  const displayed = rows.slice(-12);
  const max = Math.max(...displayed.map((row) => row.expenseCents), 1);
  const peak = displayed.reduce<ExpenseBreakdown | null>((current, row) => !current || row.expenseCents > current.expenseCents ? row : current, null);
  if (!displayed.length) return <div className="mt-5"><EmptyMessage>No expense trend is available for this period.</EmptyMessage></div>;
  return <div className="mt-6 flex flex-col"><div className="flex h-64 items-end gap-2 border-b border-slate-200 px-1">{displayed.map((row) => <div key={row.key} className="group relative flex h-full min-w-0 flex-1 items-end"><div title={`${chartLabel(row.key)}: ${money.format(row.expenseCents / 100)}`} className="w-full rounded-t-md bg-[#0b70a8] transition hover:bg-[#014171]" style={{ height: `${Math.max(4, percentage(row.expenseCents, max))}%` }} /></div>)}</div><div className="mt-2 flex gap-2 px-1">{displayed.map((row, index) => <span key={row.key} className="min-w-0 flex-1 truncate text-center text-[9px] font-semibold text-slate-400">{index % Math.ceil(displayed.length / 6) === 0 || index === displayed.length - 1 ? chartLabel(row.key) : ""}</span>)}</div><div className="mt-3 flex items-center justify-between text-[10px] text-slate-500"><span>Peak · {peak ? chartLabel(peak.key) : "—"}</span><strong className="text-slate-700">{money.format(max / 100)}</strong></div></div>;
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

function expenseBreakdown(summary: ReturnType<typeof summarizeTonerExpenses>, dimension: OverviewExpenseBreakdown): ExpenseBreakdown[] {
  if (dimension === "location") return summary.locations;
  if (dimension === "department") return summary.departments;
  return summary.tonerTypes;
}

function breakdownLabel(dimension: OverviewExpenseBreakdown) { return dimension === "toner" ? "Toner type" : dimension[0].toUpperCase() + dimension.slice(1); }

function chartLabel(key: string) {
  if (/^\d{4}$/.test(key)) return key;
  const parts = key.split("-").map(Number);
  const date = new Date(Date.UTC(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1));
  return new Intl.DateTimeFormat("en-PH", parts.length === 3 ? { month: "short", day: "numeric", timeZone: "UTC" } : { month: "short", year: "2-digit", timeZone: "UTC" }).format(date);
}

function manilaDate(value: Date) { return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Manila" }).format(value); }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" }).format(value); }
function relativeTime(value: Date, now: Date) { const seconds = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 1_000)); if (seconds < 60) return `${seconds}s ago`; if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`; if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`; return `${Math.floor(seconds / 86_400)}d ago`; }

function stockSeverity(row: { stock: number; threshold: number; critical: number }) { return row.stock <= 0 ? 3 : row.stock <= row.critical ? 2 : row.stock <= row.threshold ? 1 : 0; }
