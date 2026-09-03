import { db } from "@/db";
import { printers, repairTickets, tonerInventory, tonerTypes } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import type { ReactNode } from "react";
import {
  BellRing,
  CircleCheckBig,
  CircleOff,
  Droplets,
  Package,
  Printer,
  Ticket,
  TriangleAlert,
  Wrench,
} from "lucide";
import { PageHeader, StatCard, Card, Badge, IconGlyph } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";

export const dynamic = "force-dynamic";

const LOW_CONSUMABLE_THRESHOLD_PERCENT = 20;
const AUTO_REFRESH_SECONDS = 60;

type MonitoringSummaryRow = {
  monitored: number;
  online: number;
  offline: number;
  warning_printers: number;
  low_consumable_printers: number;
  active_alerts: number;
};

export default async function DashboardPage() {
  const renderedAt = new Date();
  const staleSeconds = await getMonitoringStaleSeconds();
  const [printerRows, ticketRows, tonerRows, monitoringResult] = await Promise.all([
    db.select({ status: printers.status, count: sql<number>`count(*)::int` }).from(printers).groupBy(printers.status),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(repairTickets)
      .where(inArray(repairTickets.status, ["Open", "In Progress"])),
    db
      .select({
        id: tonerTypes.id,
        name: tonerTypes.name,
        stock: tonerInventory.stock,
        threshold: tonerInventory.lowStockThreshold,
      })
      .from(tonerTypes)
      .leftJoin(tonerInventory, eq(tonerInventory.tonerTypeId, tonerTypes.id))
      .where(eq(tonerTypes.showAlertCard, true)),
    db.execute<MonitoringSummaryRow>(sql`
      with latest_readings as (
        select distinct on (printer_id)
          id,
          printer_id,
          checked_at,
          online,
          error_status,
          error_message
        from printer_monitoring_readings
        order by printer_id, checked_at desc, id desc
      )
      select
        count(*)::int as monitored,
        count(*) filter (
          where latest_readings.checked_at >= now() - (${staleSeconds} * interval '1 second')
            and latest_readings.online
        )::int as online,
        count(*) filter (
          where not latest_readings.online
            or latest_readings.checked_at < now() - (${staleSeconds} * interval '1 second')
        )::int as offline,
        count(*) filter (
          where latest_readings.checked_at >= now() - (${staleSeconds} * interval '1 second')
            and latest_readings.online
            and (
              nullif(btrim(latest_readings.error_status), '') is not null
              or nullif(btrim(latest_readings.error_message), '') is not null
              or exists (
                select 1
                from printer_alerts
                where printer_alerts.printer_id = latest_readings.printer_id
                  and printer_alerts.resolved_at is null
                  and lower(printer_alerts.severity) in ('warning', 'error', 'critical')
              )
            )
        )::int as warning_printers,
        (
          select count(distinct latest_consumables.printer_id)::int
          from latest_readings as latest_consumables
          inner join printer_consumable_readings
            on printer_consumable_readings.monitoring_reading_id = latest_consumables.id
          where not printer_consumable_readings.is_unknown
            and printer_consumable_readings.level_percent is not null
            and printer_consumable_readings.level_percent <= ${LOW_CONSUMABLE_THRESHOLD_PERCENT}
        ) as low_consumable_printers,
        (
          select count(*)::int
          from printer_alerts
          where printer_alerts.resolved_at is null
        ) as active_alerts
      from latest_readings
    `),
  ]);

  const total = printerRows.reduce((sum, r) => sum + r.count, 0);
  const operational = printerRows.find((r) => r.status === "Active")?.count ?? 0;
  const underRepair = printerRows.find((r) => r.status === "Under Repair")?.count ?? 0;
  const spare = printerRows.find((r) => r.status === "Spare")?.count ?? 0;
  const openTickets = ticketRows[0]?.count ?? 0;
  const monitoring = monitoringResult.rows[0] ?? {
    monitored: 0,
    online: 0,
    offline: 0,
    warning_printers: 0,
    low_consumable_printers: 0,
    active_alerts: 0,
  };
  const notMonitored = Math.max(0, total - monitoring.monitored);

  return (
    <div className="space-y-8 pb-2">
      <PageHeader
        title="Dashboard"
        subtitle="Overview of the SEAOIL printer fleet, toner inventory and open tickets."
        actions={
          <RefreshControl
            refreshedAtLabel={formatDateTime(renderedAt)}
            intervalSeconds={AUTO_REFRESH_SECONDS}
          />
        }
      />

      <section aria-labelledby="asset-status-heading">
        <SectionHeader
          id="asset-status-heading"
          eyebrow="Fleet overview"
          title="Asset status"
          description="A current snapshot of printer assets and open service work."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Total Printers" value={total} icon={Printer} accent="#014171" />
          <StatCard label="Operational" value={operational} icon={CircleCheckBig} accent="#07834c" />
          <StatCard label="Under Repair" value={underRepair} icon={Wrench} accent="#c47f08" />
          <StatCard label="Spare Units" value={spare} icon={Package} accent="#4f7fa9" />
          <StatCard label="Open Tickets" value={openTickets} icon={Ticket} accent="#c83f49" />
        </div>
      </section>

      <section aria-labelledby="live-monitoring-heading">
        <SectionHeader
          id="live-monitoring-heading"
          eyebrow="PrintDash"
          title="Live monitoring"
          description="Latest observation per printer. Stale readings count as offline; asset lifecycle status remains separate."
          aside={(
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              {monitoring.monitored} monitored
              <span className="text-slate-300" aria-hidden="true">·</span>
              {notMonitored} not monitored
            </div>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Online Printers" value={monitoring.online} icon={CircleCheckBig} accent="#07834c" />
          <StatCard label="Offline Printers" value={monitoring.offline} icon={CircleOff} accent="#c83f49" />
          <StatCard label="Warning Printers" value={monitoring.warning_printers} icon={TriangleAlert} accent="#c47f08" />
          <StatCard
            label="Low Consumables"
            value={monitoring.low_consumable_printers}
            icon={Droplets}
            accent="#dd6516"
          />
          <StatCard label="Active Alerts" value={monitoring.active_alerts} icon={BellRing} accent="#7c4dcc" />
        </div>
      </section>

      <section aria-labelledby="toner-inventory-heading">
        <SectionHeader
          id="toner-inventory-heading"
          eyebrow="Supplies"
          title="Toner inventory"
          description="On-hand stock for toner types included in inventory alerts."
        />
        {tonerRows.length === 0 ? (
          <Card className="p-10 text-center text-sm text-slate-500">
            No toner types have been added yet. Add one from System Settings.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tonerRows.map((t) => {
              const stock = t.stock ?? 0;
              const threshold = t.threshold ?? 5;
              const low = stock <= threshold;
              return (
                <Card
                  key={t.id}
                  className={`relative overflow-hidden p-5 ${low ? "border-red-200 bg-red-50/20" : ""}`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 w-1 ${low ? "bg-red-500" : "bg-emerald-500"}`}
                  />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${low ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-600"}`}>
                        <IconGlyph icon={Droplets} size={17} />
                      </span>
                      <p className="truncate text-sm font-semibold text-[#014171]" title={t.name}>{t.name}</p>
                    </div>
                    {low ? <Badge color="red">Low Stock</Badge> : <Badge color="green">Healthy</Badge>}
                  </div>
                  <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                    <p className="text-3xl font-bold leading-none tracking-[-0.035em] text-slate-900">
                      {stock} <span className="text-xs font-semibold tracking-normal text-slate-500">on hand</span>
                    </p>
                    <p className="shrink-0 text-[11px] font-medium text-slate-500">Threshold {threshold}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  aside,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">{eyebrow}</p>
        <h2 id={id} className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">{title}</h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">{description}</p>
      </div>
      {aside && <div className="shrink-0">{aside}</div>}
    </div>
  );
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}
