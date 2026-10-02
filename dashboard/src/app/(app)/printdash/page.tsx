import Link from "next/link";
import { printerDetailHref } from "@/lib/printer-navigation";
import { sql, type SQL } from "drizzle-orm";
import {
  BellRing,
  CircleCheckBig,
  CircleHelp,
  CircleOff,
  Clock3,
  Droplets,
  TriangleAlert,
  type IconNode,
} from "lucide";
import { db } from "@/db";
import { Badge, Card, PageHeader, StatCard, TableCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import PrintDashStatusToasts, {
  type PrinterToastSnapshot,
} from "./PrintDashStatusToasts";
import CollapsibleFilterPanel from "@/components/CollapsibleFilterPanel";
import SearchInput from "@/components/SearchInput";
import SearchableDropdown from "@/components/SearchableDropdown";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";
import { requireModuleFullAccess } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

const LOW_CONSUMABLE_THRESHOLD_PERCENT = 20;
const AUTO_REFRESH_SECONDS = 60;
const STATUS_FILTERS = new Set(["online", "offline", "warning", "stale", "not-monitored"]);

type MonitoringSummaryRow = {
  total: number;
  online: number;
  offline: number;
  warning: number;
  stale: number;
  low_consumable: number;
  not_monitored: number;
  active_alerts: number;
};

type LocationRow = { id: number; name: string };
type DatabaseTimestamp = Date | string;
type TonerConsumable = {
  name: string;
  level: number | null;
  unknown: boolean;
  status: string | null;
};

type PrinterMonitoringRow = {
  id: number;
  asset_tag: string | null;
  serial_number: string;
  model: string | null;
  ip_address: string | null;
  location_name: string | null;
  department_name: string | null;
  reading_id: number | null;
  online: boolean | null;
  checked_at: DatabaseTimestamp | null;
  printer_status: string | null;
  page_count: number | string | null;
  has_warning: boolean;
  warning_types: string[];
  is_stale: boolean;
  agent_name: string | null;
  agent_last_seen: DatabaseTimestamp | null;
  agent_is_stale: boolean;
  consumable_name: string | null;
  consumable_level: number | null;
  consumable_is_unknown: boolean | null;
  consumable_status: string | null;
  toner_consumables: TonerConsumable[];
};

const warningCondition = sql`
  latest_readings.online is true
  and (
    nullif(btrim(latest_readings.error_status), '') is not null
    or nullif(btrim(latest_readings.error_message), '') is not null
    or coalesce(active_alerts.has_warning, false)
  )
`;

export default async function PrintDashPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; location?: string }>;
}) {
  await requireModuleFullAccess("monitoring_alerts");
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const status = params.status && STATUS_FILTERS.has(params.status) ? params.status : "";
  const parsedLocation = Number.parseInt(params.location ?? "", 10);
  const locationId = Number.isSafeInteger(parsedLocation) && parsedLocation > 0 ? parsedLocation : null;
  const activeFilterCount = [query, status, locationId].filter(Boolean).length;
  const renderedAt = new Date();
  const staleSeconds = await getMonitoringStaleSeconds();
  const freshCondition = sql`
    latest_readings.checked_at >= now() - (${staleSeconds} * interval '1 second')
  `;
  const staleCondition = sql`
    latest_readings.id is not null and not (${freshCondition})
  `;

  const filters: SQL[] = [];
  if (query) {
    const pattern = `%${query}%`;
    filters.push(sql`(
      printers.asset_tag ilike ${pattern}
      or printers.serial_number ilike ${pattern}
      or printers.model ilike ${pattern}
      or coalesce(printers.ip_address, '') ilike ${pattern}
      or coalesce(offices.name, '') ilike ${pattern}
      or coalesce(departments.name, '') ilike ${pattern}
    )`);
  }
  if (locationId !== null) filters.push(sql`printers.office_id = ${locationId}`);
  if (status === "online") {
    filters.push(sql`
      (${freshCondition})
      and latest_readings.online is true
    `);
  }
  if (status === "offline") {
    filters.push(sql`(${freshCondition}) and latest_readings.online is false`);
  }
  if (status === "warning") {
    filters.push(sql`(${freshCondition}) and (${warningCondition})`);
  }
  if (status === "stale") filters.push(staleCondition);
  if (status === "not-monitored") filters.push(sql`latest_readings.id is null`);

  const whereClause = filters.length ? sql`where ${sql.join(filters, sql` and `)}` : sql``;
  const latestReadingsCte = sql`
    with latest_readings as (
      select distinct on (printer_id)
        id, printer_id, agent_id, checked_at, online, printer_status, page_count, error_status, error_message
      from printer_monitoring_readings
      order by printer_id, checked_at desc, id desc
    ),
    active_alerts as (
      select
        printer_id,
        bool_or(lower(severity) in ('warning', 'error', 'critical')) as has_warning,
        array_agg(distinct lower(type)) filter (
          where lower(severity) in ('warning', 'error', 'critical')
        ) as warning_types
      from printer_alerts
      where resolved_at is null
      group by printer_id
    )
  `;

  const [summaryResult, printerResult, locationsResult] = await Promise.all([
    db.execute<MonitoringSummaryRow>(sql`
      ${latestReadingsCte}
      select
        count(*)::int as total,
        count(*) filter (
          where (${freshCondition})
            and latest_readings.online is true
        )::int as online,
        count(*) filter (
          where (${freshCondition}) and latest_readings.online is false
        )::int as offline,
        count(*) filter (
          where (${freshCondition}) and (${warningCondition})
        )::int as warning,
        count(*) filter (where ${staleCondition})::int as stale,
        count(*) filter (
          where exists (
            select 1
            from printer_consumable_readings
            where printer_consumable_readings.monitoring_reading_id = latest_readings.id
              and printer_consumable_readings.is_unknown is false
              and printer_consumable_readings.level_percent is not null
              and printer_consumable_readings.level_percent <= ${LOW_CONSUMABLE_THRESHOLD_PERCENT}
          )
        )::int as low_consumable,
        count(*) filter (where latest_readings.id is null)::int as not_monitored,
        (
          select count(*)::int
          from printer_alerts
          where resolved_at is null
        ) as active_alerts
      from printers
      left join latest_readings on latest_readings.printer_id = printers.id
      left join active_alerts on active_alerts.printer_id = printers.id
    `),
    db.execute<PrinterMonitoringRow>(sql`
      ${latestReadingsCte}
      select
        printers.id,
        printers.asset_tag,
        printers.serial_number,
        printers.model,
        printers.ip_address,
        offices.name as location_name,
        departments.name as department_name,
        latest_readings.id as reading_id,
        latest_readings.online,
        latest_readings.checked_at,
        latest_readings.printer_status,
        latest_readings.page_count,
        (${warningCondition}) as has_warning,
        coalesce(active_alerts.warning_types, array[]::text[]) as warning_types,
        (${staleCondition}) as is_stale,
        monitoring_agents.name as agent_name,
        monitoring_agents.last_seen as agent_last_seen,
        (
          monitoring_agents.id is not null
          and (
            monitoring_agents.last_seen is null
            or monitoring_agents.last_seen < now() - (${staleSeconds} * interval '1 second')
          )
        ) as agent_is_stale,
        latest_consumable.name as consumable_name,
        latest_consumable.level_percent as consumable_level,
        latest_consumable.is_unknown as consumable_is_unknown,
        latest_consumable.status as consumable_status,
        coalesce(latest_toners.items, '[]'::jsonb) as toner_consumables
      from printers
      left join offices on offices.id = printers.office_id
      left join departments on departments.id = printers.department_id
      left join latest_readings on latest_readings.printer_id = printers.id
      left join monitoring_agents on monitoring_agents.id = latest_readings.agent_id
      left join active_alerts on active_alerts.printer_id = printers.id
      left join lateral (
        select name, level_percent, is_unknown, status
        from printer_consumable_readings
        where monitoring_reading_id = latest_readings.id
        order by
          case when is_unknown is false and level_percent is not null then 0 else 1 end,
          level_percent asc nulls last,
          id desc
        limit 1
      ) as latest_consumable on true
      left join lateral (
        select jsonb_agg(
          jsonb_build_object(
            'name', name,
            'level', level_percent,
            'unknown', is_unknown,
            'status', status
          )
          order by
            case
              when lower(name) like '%black%' then 1
              when lower(name) like '%cyan%' then 2
              when lower(name) like '%magenta%' then 3
              when lower(name) like '%yellow%' then 4
              else 5
            end,
            name
        ) as items
        from printer_consumable_readings
        where monitoring_reading_id = latest_readings.id
          and type = 'toner'
          and lower(name) not like '%waste%'
          and lower(name) not like '%belt%'
      ) as latest_toners on true
      ${whereClause}
      order by
        case when latest_readings.id is null then 1 else 0 end,
        printers.model,
        printers.serial_number
    `),
    db.execute<LocationRow>(sql`select id, name from offices order by name`),
  ]);

  const summary = summaryResult.rows[0] ?? {
    total: 0,
    online: 0,
    offline: 0,
    warning: 0,
    stale: 0,
    low_consumable: 0,
    not_monitored: 0,
    active_alerts: 0,
  };
  const toastSnapshots = printerResult.rows.map(toPrinterToastSnapshot);

  return (
    <div>
      <PrintDashStatusToasts printers={toastSnapshots} />
      <PageHeader
        title="SEAOIL Printer Operations & Tracking"
        subtitle="Live Printer Monitoring"
        actions={
          <RefreshControl
            refreshedAtLabel={formatDateTime(renderedAt)}
            intervalSeconds={AUTO_REFRESH_SECONDS}
            iconOnly
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        <MonitoringStatCard label="Online" value={summary.online} icon={CircleCheckBig} accent="#07834c" />
        <MonitoringStatCard label="Offline" value={summary.offline} icon={CircleOff} accent="#c83f49" />
        <MonitoringStatCard label="Warning" value={summary.warning} icon={TriangleAlert} accent="#c47f08" />
        <MonitoringStatCard label="Stale" value={summary.stale} icon={Clock3} accent="#a56510" />
        <MonitoringStatCard label="Low Consumable" value={summary.low_consumable} icon={Droplets} accent="#dd6516" />
        <MonitoringStatCard label="Not Monitored" value={summary.not_monitored} icon={CircleHelp} accent="#64748b" />
        <MonitoringStatCard label="Active Alerts" value={summary.active_alerts} icon={BellRing} accent="#7c4dcc" />
      </div>

      <CollapsibleFilterPanel activeFilterCount={activeFilterCount} className="mt-6">
        <AutoSubmitFilterForm
          resetKey={[status, locationId ?? ""].join("|")}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))_auto]"
        >
          <SearchInput
            label="Search printers"
            name="q"
            defaultValue={query}
            submitOnChange
            placeholder="Name, model, serial, IP, office…"
            aria-label="Search monitored printers"
          />
          <SearchableDropdown label="Monitoring status" name="status" defaultValue={status} autoSubmit placeholder="Search statuses..." options={[{ value: "", label: "All statuses" }, { value: "online", label: "Online" }, { value: "offline", label: "Offline" }, { value: "warning", label: "Warning" }, { value: "stale", label: "Stale" }, { value: "not-monitored", label: "Not monitored" }]} />
          <SearchableDropdown label="Office" name="location" defaultValue={locationId?.toString() ?? ""} autoSubmit placeholder="Search offices..." options={[{ value: "", label: "All offices" }, ...locationsResult.rows.map((location) => ({ value: String(location.id), label: location.name }))]} />
          <div className="flex items-end sm:justify-start xl:justify-end">
            <Link
              href="/printdash"
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Clear
            </Link>
          </div>
        </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <div className="mt-6 flex flex-col justify-between gap-1 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-lg font-bold text-[#014171]">Printer Monitoring</h2>
          <p className="mt-1 text-xs text-slate-500">One row per printer, using only its newest monitoring reading.</p>
        </div>
        <p className="text-xs text-slate-500">
          {printerResult.rows.length} {printerResult.rows.length === 1 ? "printer" : "printers"} shown
        </p>
      </div>

      <TableCard className="mt-3 overscroll-contain">
        {printerResult.rows.length === 0 ? (
          <div className="flex min-h-52 items-center justify-center px-5 text-center text-sm text-slate-500">
            {summary.total === 0
              ? "No printer assets have been added yet."
              : "No printers match the selected filters."}
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 lg:hidden">
              {printerResult.rows.map((printer) => (
                <PrinterMonitoringCard
                  key={printer.id}
                  printer={printer}
                  renderedAt={renderedAt}
                />
              ))}
            </div>

            <div className="hidden lg:block">
              <table className="w-full min-w-[1180px] table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[200px]" />
                  <col className="w-[150px]" />
                  <col className="w-[210px]" />
                  <col className="w-[150px]" />
                  <col className="w-[180px]" />
                  <col className="w-[100px]" />
                  <col className="w-[190px]" />
                </colgroup>
                <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3">Office / Department</th>
                    <th className="whitespace-nowrap px-4 py-3">IP Address</th>
                    <th className="whitespace-nowrap px-4 py-3">Model / Serial Number</th>
                    <th className="whitespace-nowrap px-4 py-3">Status</th>
                    <th className="whitespace-nowrap px-4 py-3">Toner Type / Level</th>
                    <th className="whitespace-nowrap px-4 py-3 text-right">Pages</th>
                    <th className="whitespace-nowrap px-4 py-3">Last Seen / Agent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {printerResult.rows.map((printer) => (
                    <tr key={printer.id} className="align-top transition hover:bg-slate-50/80">
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 text-xs font-medium text-slate-700">
                          {printer.location_name ?? "Unassigned"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                          {printer.department_name ?? "No department"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {printer.ip_address ? (
                          <a
                            href={printerWebUrl(printer.ip_address)}
                            target="_blank"
                            rel="noreferrer"
                            className="block truncate text-xs font-semibold text-[#014171] hover:underline"
                            title={`Open ${printer.ip_address} in a new browser tab`}
                          >
                            {printer.ip_address}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400">No IP address</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="line-clamp-2 text-xs font-medium text-slate-700">
                          {printer.model || "Model not available"}
                        </p>
                        <Link
                          href={printerDetailHref(printer.id, "/printdash")}
                          className="mt-1 block truncate text-xs font-semibold text-[#014171] hover:underline"
                          title={`View printer ${printer.serial_number}`}
                        >
                          {printer.serial_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <MonitoringBadges printer={printer} />
                        <p className="mt-1.5 truncate text-xs text-slate-500">
                          {printer.reading_id === null ? "—" : printer.printer_status ?? "Unknown"}
                        </p>
                      </td>
                      <td className="px-4 py-3"><ConsumableLevel printer={printer} /></td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {formatPageCount(printer.page_count)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-slate-700" title={printer.checked_at ? formatDateTime(printer.checked_at) : undefined}>
                          {printer.checked_at ? formatRelativeTime(printer.checked_at, renderedAt) : "Never"}
                        </p>
                        <div className="mt-1"><AgentLastSeen printer={printer} renderedAt={renderedAt} /></div>
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

function MonitoringStatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: IconNode;
  accent: string;
}) {
  return (
    <StatCard label={label} value={value} icon={icon} accent={accent} compact />
  );
}

function PrinterMonitoringCard({
  printer,
  renderedAt,
}: {
  printer: PrinterMonitoringRow;
  renderedAt: Date;
}) {
  return (
    <article className="min-w-0 p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="break-words text-xs font-medium text-slate-500">
            {printer.model || "Model not available"}
          </p>
          <Link
            href={printerDetailHref(printer.id, "/printdash")}
            className="mt-1 block truncate font-semibold text-[#014171] hover:underline"
          >
            {printer.serial_number}
          </Link>
        </div>
        <div className="shrink-0"><MonitoringBadges printer={printer} /></div>
      </div>

      <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-4 text-xs">
        <MonitoringDetail
          label="Office / Department"
          value={`${printer.location_name ?? "Unassigned"} / ${printer.department_name ?? "No department"}`}
        />
        <div className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">IP Address</dt>
          <dd className="mt-1 break-words font-medium">
            {printer.ip_address ? (
              <a
                href={printerWebUrl(printer.ip_address)}
                target="_blank"
                rel="noreferrer"
                className="text-[#014171] hover:underline"
              >
                {printer.ip_address}
              </a>
            ) : (
              <span className="text-slate-400">—</span>
            )}
          </dd>
        </div>
        <MonitoringDetail
          label="Printer Status"
          value={printer.reading_id === null ? "—" : printer.printer_status ?? "Unknown"}
        />
        <MonitoringDetail label="Page Count" value={formatPageCount(printer.page_count)} />
        <div className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Toner Type / Level</dt>
          <dd className="mt-1"><ConsumableLevel printer={printer} /></dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Last Checked</dt>
          <dd
            className="mt-1 break-words font-medium text-slate-700"
            title={printer.checked_at ? formatDateTime(printer.checked_at) : undefined}
          >
            {printer.checked_at ? formatRelativeTime(printer.checked_at, renderedAt) : "Never"}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Reporting Agent</dt>
          <dd className="mt-1"><AgentLastSeen printer={printer} renderedAt={renderedAt} /></dd>
        </div>
      </dl>
    </article>
  );
}

function MonitoringDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words font-medium text-slate-700">{value}</dd>
    </div>
  );
}

function MonitoringBadges({ printer }: { printer: PrinterMonitoringRow }) {
  if (printer.reading_id === null) return <Badge color="gray">Not Monitored</Badge>;
  if (printer.is_stale) return <Badge color="orange">Stale</Badge>;
  if (printer.online === false) return <Badge color="red">Offline</Badge>;
  if (printer.has_warning) return <Badge color="yellow">Warning</Badge>;
  return <Badge color="green">Online</Badge>;
}

function AgentLastSeen({
  printer,
  renderedAt,
}: {
  printer: PrinterMonitoringRow;
  renderedAt: Date;
}) {
  if (printer.reading_id === null) {
    return <span className="text-[11px] text-slate-400">Not Monitored</span>;
  }
  if (!printer.agent_name) {
    return <span className="text-[11px] text-slate-400">Agent not available</span>;
  }

  return (
    <div className="min-w-0">
      <p className="break-words text-[11px] font-medium text-slate-600">{printer.agent_name}</p>
      <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
        <span
          className="text-[10px] text-slate-400"
          title={printer.agent_last_seen ? formatDateTime(printer.agent_last_seen) : undefined}
        >
          {printer.agent_last_seen
            ? `Last seen ${formatRelativeTime(printer.agent_last_seen, renderedAt)}`
            : "Last seen unavailable"}
        </span>
        {printer.agent_is_stale && <Badge color="orange">Agent stale</Badge>}
      </div>
    </div>
  );
}

function ConsumableLevel({ printer }: { printer: PrinterMonitoringRow }) {
  if (printer.reading_id === null || printer.consumable_name === null) return <span className="text-slate-400">—</span>;
  const toners = Array.isArray(printer.toner_consumables)
    ? printer.toner_consumables
    : [];

  if (toners.length > 0) {
    return (
      <div
        className={toners.length > 1 ? "grid max-w-48 grid-cols-2 gap-1" : "flex max-w-48"}
        aria-label={`${toners.length} toner ${toners.length === 1 ? "level" : "levels"}`}
      >
        {toners.map((toner) => {
          const unknown = toner.unknown || toner.level === null;
          const low = !unknown && toner.level! <= LOW_CONSUMABLE_THRESHOLD_PERCENT;
          const value = unknown ? "?" : `${toner.level}%`;
          const displayLabel = tonerDisplayLabel(toner.name, printer);

          return (
            <span
              key={toner.name}
              className={`inline-flex min-w-0 items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-semibold leading-none ${
                low
                  ? "border-orange-200 bg-orange-50 text-orange-700"
                  : unknown
                    ? "border-slate-200 bg-slate-50 text-slate-500"
                    : "border-slate-200 bg-white text-slate-700"
              }`}
              title={`${displayLabel}: ${unknown ? toner.status || "Unknown" : `${toner.level}%`} (reported as ${toner.name})`}
              aria-label={`${displayLabel}: ${unknown ? toner.status || "Unknown" : `${toner.level} percent`}`}
            >
              <span className="shrink-0 text-slate-500">{displayLabel}</span>
              <span className="truncate">{value}</span>
            </span>
          );
        })}
      </div>
    );
  }

  const unknown = printer.consumable_is_unknown || printer.consumable_level === null;
  if (unknown) {
    return (
      <div>
        <p className="max-w-48 truncate text-xs font-medium text-slate-700" title={printer.consumable_name}>{printer.consumable_name}</p>
        <Badge color="gray">{printer.consumable_status || "Unknown"}</Badge>
      </div>
    );
  }
  const low = printer.consumable_level! <= LOW_CONSUMABLE_THRESHOLD_PERCENT;
  return (
    <div>
      <p className="max-w-48 truncate text-xs font-medium text-slate-700" title={printer.consumable_name}>{printer.consumable_name}</p>
      <span className={`text-sm font-semibold ${low ? "text-orange-600" : "text-slate-700"}`}>{printer.consumable_level}%</span>
      {low && <span className="ml-1.5 text-xs text-orange-600">Low</span>}
    </div>
  );
}

function tonerDisplayLabel(
  name: string,
  printer: Pick<PrinterMonitoringRow, "model">,
) {
  const normalized = name.toLowerCase();
  const printerIdentity = (printer.model ?? "").toLowerCase();

  if (
    printerIdentity.includes("canon") &&
    printerIdentity.includes("mf244w") &&
    /\b337\b/.test(normalized)
  ) {
    return "B 283X";
  }

  const color = normalized.includes("black")
    ? "B"
    : normalized.includes("cyan")
      ? "C"
      : normalized.includes("magenta")
        ? "M"
        : normalized.includes("yellow")
          ? "Y"
          : "";
  const cartridgeCode = name.match(
    /\b(?:[A-Z]{1,5}[- ]?\d{2,}[A-Z0-9-]*|\d{3,}[A-Z0-9-]*)\b/i,
  )?.[0];
  const tonerType = cartridgeCode?.replace(/\s+/g, "").toUpperCase();

  return [color, tonerType].filter(Boolean).join(" ") || "Toner";
}

function printerWebUrl(value: string) {
  const address = value.trim();
  if (/^https?:\/\//i.test(address)) return address;

  const host = address.includes(":") && !address.startsWith("[")
    ? `[${address}]`
    : address;
  return `http://${host}`;
}

function formatPageCount(value: number | string | null) {
  if (value === null) return "—";
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) ? new Intl.NumberFormat("en-PH").format(parsed) : String(value);
}

function formatDateTime(value: DatabaseTimestamp) {
  const date = normalizeTimestamp(value);
  if (!date) return "Not available";
  return date.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
}

function formatRelativeTime(value: DatabaseTimestamp, relativeTo: Date) {
  const date = normalizeTimestamp(value);
  if (!date) return "Not available";
  const elapsedSeconds = Math.max(
    0,
    Math.floor((relativeTo.getTime() - date.getTime()) / 1_000),
  );
  if (elapsedSeconds < 5) return "Just now";
  if (elapsedSeconds < 60) return `${elapsedSeconds} seconds ago`;

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes} ${elapsedMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours} ${elapsedHours === 1 ? "hour" : "hours"} ago`;
  }

  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 7) {
    return `${elapsedDays} ${elapsedDays === 1 ? "day" : "days"} ago`;
  }

  return formatDateTime(date);
}

function normalizeTimestamp(value: DatabaseTimestamp) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toPrinterToastSnapshot(
  printer: PrinterMonitoringRow,
): PrinterToastSnapshot {
  const tonerConsumables = Array.isArray(printer.toner_consumables)
    ? printer.toner_consumables
    : [];
  const lowConsumable = tonerConsumables.length > 0
    ? tonerConsumables.some(
        (toner) =>
          !toner.unknown &&
          toner.level !== null &&
          toner.level <= LOW_CONSUMABLE_THRESHOLD_PERCENT,
      )
    : printer.consumable_is_unknown === false &&
      printer.consumable_level !== null &&
      printer.consumable_level <= LOW_CONSUMABLE_THRESHOLD_PERCENT;
  const warningTypes = [...(printer.warning_types ?? [])].sort();
  const paperWarning = warningTypes.some((type) =>
    ["paper", "jam", "tray"].some((keyword) => type.includes(keyword)),
  );
  const warningCategories = [
    ...(lowConsumable ? ["low-consumable"] : []),
    ...warningTypes,
    ...(printer.has_warning && warningTypes.length === 0 ? ["device-warning"] : []),
  ];

  return {
    id: printer.id,
    label: printer.asset_tag || `Printer ${printer.id}`,
    online: printer.reading_id === null ? null : printer.online,
    stale: printer.is_stale,
    warningKey: warningCategories.length > 0 ? warningCategories.join("|") : null,
    warningType: paperWarning
      ? "paper-warning"
      : lowConsumable
        ? "low-consumable"
        : warningCategories.length > 0
          ? "device-warning"
          : null,
  };
}
