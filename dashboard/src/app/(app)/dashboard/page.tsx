import { db } from "@/db";
import { printers, repairTickets, tonerInventory, tonerTypes } from "@/db/schema";
import { eq, inArray, sql } from "drizzle-orm";
import { PageHeader, StatCard, Card, Badge } from "@/components/ui";
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
    <div>
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Printers" value={total} icon="🖨️" accent="#014171" />
        <StatCard label="Operational" value={operational} icon="✅" accent="#0f9d58" />
        <StatCard label="Under Repair" value={underRepair} icon="🛠️" accent="#e2a800" />
        <StatCard label="Spare Units" value={spare} icon="📦" accent="#7DA8D0" />
        <StatCard label="Open Tickets" value={openTickets} icon="🎫" accent="#d64545" />
      </div>

      <section className="mt-8">
        <div className="mb-4 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-bold text-[#014171]">Live Monitoring</h2>
            <p className="mt-1 text-xs text-slate-500">
              Current PrintDash observation per printer. Stale readings are counted offline; asset lifecycle status is counted separately above.
            </p>
          </div>
          <p className="text-xs text-slate-500">
            {monitoring.monitored} monitored · {notMonitored} not monitored
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Online Printers" value={monitoring.online} icon="●" accent="#0f9d58" />
          <StatCard label="Offline Printers" value={monitoring.offline} icon="●" accent="#d64545" />
          <StatCard label="Warning Printers" value={monitoring.warning_printers} icon="⚠️" accent="#e2a800" />
          <StatCard
            label="Low Consumables"
            value={monitoring.low_consumable_printers}
            icon="🧴"
            accent="#f97316"
          />
          <StatCard label="Active Monitoring Alerts" value={monitoring.active_alerts} icon="🔔" accent="#8b5cf6" />
        </div>

      </section>

      <div className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-[#014171]">Toners Stocks</h2>
        {tonerRows.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500">
            No toner types have been added yet. Add one from System Settings.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {tonerRows.map((t) => {
              const stock = t.stock ?? 0;
              const threshold = t.threshold ?? 5;
              const low = stock <= threshold;
              return (
                <Card key={t.id} className={`p-5 ${low ? "border-red-300" : ""}`}>
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-[#014171]">{t.name}</p>
                    {low ? <Badge color="red">Low Stock</Badge> : <Badge color="green">Healthy</Badge>}
                  </div>
                  <p className="mt-3 text-2xl font-bold text-slate-800">{stock} <span className="text-sm font-normal text-slate-400">on hand</span></p>
                  <p className="mt-1 text-xs text-slate-400">Threshold: {threshold} units</p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
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
