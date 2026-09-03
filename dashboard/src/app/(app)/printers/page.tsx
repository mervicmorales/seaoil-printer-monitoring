import Link from "next/link";
import { db } from "@/db";
import { printers, locations, departments } from "@/db/schema";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { Eye, Plus, Printer } from "lucide";
import { Badge, PageHeader, TableCard, EmptyState, statusBadgeColor, IconGlyph } from "@/components/ui";
import { requireSession, getModuleAccessMap } from "@/lib/server-utils";
import { PRINTER_STATUSES } from "@/lib/constants";
import SuccessBanner from "@/components/SuccessBanner";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import { printerDetailHref } from "@/lib/printer-navigation";
import CollapsibleFilterPanel from "@/components/CollapsibleFilterPanel";
import SearchInput from "@/components/SearchInput";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";
import RefreshControl from "@/components/RefreshControl";

export const dynamic = "force-dynamic";
const LOW_CONSUMABLE_THRESHOLD_PERCENT = 20;
const AUTO_REFRESH_SECONDS = 60;

type TonerConsumable = {
  name: string;
  level: number | null;
  unknown: boolean;
  status: string | null;
};

type PrinterMonitoringSnapshot = {
  id: number;
  model: string | null;
  reading_id: number | null;
  online: boolean | null;
  printer_status: string | null;
  has_warning: boolean;
  is_stale: boolean;
  consumable_name: string | null;
  consumable_level: number | null;
  consumable_is_unknown: boolean | null;
  consumable_status: string | null;
  toner_consumables: TonerConsumable[];
};

function printerWebUrl(ipAddress: string) {
  return /^https?:\/\//i.test(ipAddress) ? ipAddress : `http://${ipAddress}`;
}

export default async function PrintersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; location?: string; success?: string }>;
}) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const renderedAt = new Date();

  const conditions = [];
  if (query) {
    conditions.push(
      or(
        ilike(printers.serialNumber, `%${query}%`),
        ilike(printers.assetTag, `%${query}%`),
        ilike(printers.ipAddress, `%${query}%`),
        ilike(printers.model, `%${query}%`),
        ilike(locations.name, `%${query}%`),
        ilike(departments.name, `%${query}%`),
      ),
    );
  }
  if (params.status) conditions.push(eq(printers.status, params.status));
  if (params.location) conditions.push(eq(printers.locationId, Number(params.location)));

  const rows = await db
    .select({
      id: printers.id,
      ipAddress: printers.ipAddress,
      serialNumber: printers.serialNumber,
      model: printers.model,
      status: printers.status,
      locationName: locations.name,
      departmentName: departments.name,
    })
    .from(printers)
    .leftJoin(locations, eq(printers.locationId, locations.id))
    .leftJoin(departments, eq(printers.departmentId, departments.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(printers.id));

  const staleSeconds = await getMonitoringStaleSeconds();
  const monitoringResult = await db.execute<PrinterMonitoringSnapshot>(sql`
    with latest_readings as (
      select distinct on (printer_id)
        id, printer_id, checked_at, online, printer_status, error_status, error_message
      from printer_monitoring_readings
      order by printer_id, checked_at desc, id desc
    ),
    active_alerts as (
      select
        printer_id,
        bool_or(lower(severity) in ('warning', 'error', 'critical')) as has_warning
      from printer_alerts
      where resolved_at is null
      group by printer_id
    )
    select
      printers.id,
      printers.model,
      latest_readings.id as reading_id,
      latest_readings.online,
      latest_readings.printer_status,
      (
        latest_readings.online is true
        and (
          nullif(btrim(latest_readings.error_status), '') is not null
          or nullif(btrim(latest_readings.error_message), '') is not null
          or coalesce(active_alerts.has_warning, false)
        )
      ) as has_warning,
      (
        latest_readings.id is not null
        and latest_readings.checked_at < now() - (${staleSeconds} * interval '1 second')
      ) as is_stale,
      latest_consumable.name as consumable_name,
      latest_consumable.level_percent as consumable_level,
      latest_consumable.is_unknown as consumable_is_unknown,
      latest_consumable.status as consumable_status,
      coalesce(latest_toners.items, '[]'::jsonb) as toner_consumables
    from printers
    left join latest_readings on latest_readings.printer_id = printers.id
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
  `);
  const monitoringByPrinter = new Map(
    monitoringResult.rows.map((snapshot) => [snapshot.id, snapshot]),
  );

  const allLocations = await db.select().from(locations).orderBy(asc(locations.name));
  const totalCount = await db.select({ count: sql<number>`count(*)::int` }).from(printers);
  const activeFilterCount = [query, params.status, params.location].filter(Boolean).length;
  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  if (params.status) returnParams.set("status", params.status);
  if (params.location) returnParams.set("location", params.location);
  const printerListReturnTo = returnParams.size > 0
    ? `/printers?${returnParams.toString()}`
    : "/printers";

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader
        title="Printers"
        subtitle={`${totalCount[0]?.count ?? 0} printer(s) tracked across all locations`}
        actions={(
          <>
            <RefreshControl
              refreshedAtLabel={formatDateTime(renderedAt)}
              intervalSeconds={AUTO_REFRESH_SECONDS}
            />
            {access.printers && (
            <Link
              href="/printers/new"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md"
            >
              <IconGlyph icon={Plus} size={16} />
              Add Printer
            </Link>
            )}
          </>
        )}
      />

      <SuccessBanner message={params.success} showInline={false} />

      <CollapsibleFilterPanel activeFilterCount={activeFilterCount}>
        <AutoSubmitFilterForm
          resetKey={[query, params.status ?? "", params.location ?? ""].join("|")}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))_auto]"
          method="get"
        >
          <SearchInput
            key={query}
            name="q"
            defaultValue={query}
            placeholder="Serial, asset tag, IP, model, location or department"
            aria-label="Search printers"
          />
          <select name="status" defaultValue={params.status || ""} className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15">
            <option value="">All Statuses</option>
            {PRINTER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select name="location" defaultValue={params.location || ""} className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15">
            <option value="">All Locations</option>
            {allLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <Link href="/printers" className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
            Clear
          </Link>
        </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No printers found. Try adjusting your filters or add a new printer." />
        ) : (
          <>
          <div className="divide-y divide-slate-100 lg:hidden">
            {rows.map((p) => {
              const monitoring = monitoringByPrinter.get(p.id) ?? null;
              return (
                <article key={p.id} className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                        <IconGlyph icon={Printer} size={17} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">{p.model || "Model not available"}</p>
                        <Link
                          href={printerDetailHref(p.id, printerListReturnTo)}
                          className="mt-0.5 block truncate font-mono text-xs font-semibold text-[#014171]"
                        >
                          {p.serialNumber}
                        </Link>
                      </div>
                    </div>
                    <Badge color={statusBadgeColor(p.status)}>{p.status}</Badge>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs">
                    <MobileField label="Location" value={p.locationName ?? "Unassigned"} />
                    <MobileField label="Department" value={p.departmentName ?? "No department"} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">IP Address</p>
                      {p.ipAddress ? (
                        <a href={printerWebUrl(p.ipAddress)} target="_blank" rel="noreferrer" className="mt-1 block truncate font-mono font-semibold text-[#014171]">
                          {p.ipAddress}
                        </a>
                      ) : <p className="mt-1 text-slate-500">No IP address</p>}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Monitoring</p>
                      <div className="mt-1"><MonitoringBadge printer={monitoring} /></div>
                    </div>
                    <div className="col-span-2">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Toner</p>
                      <ConsumableLevel printer={monitoring} />
                    </div>
                  </div>

                  <Link
                    href={printerDetailHref(p.id, printerListReturnTo)}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"
                  >
                    <IconGlyph icon={Eye} size={14} />
                    View printer
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="hidden lg:block">
          <table className="w-full min-w-[1085px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[200px]" />
              <col className="w-[150px]" />
              <col className="w-[210px]" />
              <col className="w-[150px]" />
              <col className="w-[180px]" />
              <col className="w-[120px]" />
              <col className="w-[75px]" />
            </colgroup>
            <thead className="bg-slate-50 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Location / Department</th>
                <th className="whitespace-nowrap px-4 py-3">IP Address</th>
                <th className="whitespace-nowrap px-4 py-3">Model / Serial Number</th>
                <th className="whitespace-nowrap px-4 py-3">Monitoring Status</th>
                <th className="whitespace-nowrap px-4 py-3">Toner Type / Level</th>
                <th className="whitespace-nowrap px-4 py-3">Asset Status</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => {
                const monitoring = monitoringByPrinter.get(p.id) ?? null;
                return (
                <tr key={p.id} className="transition hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 text-xs font-medium text-slate-700">
                      {p.locationName ?? "Unassigned"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {p.departmentName ?? "No department"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {p.ipAddress ? (
                      <a
                        href={printerWebUrl(p.ipAddress)}
                        target="_blank"
                        rel="noreferrer"
                        className="block truncate font-mono text-xs font-semibold text-[#014171] hover:underline"
                        title={`Open ${p.ipAddress} in a new browser tab`}
                      >
                        {p.ipAddress}
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">No IP address</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="line-clamp-2 text-xs font-medium text-slate-700">
                      {p.model || "Model not available"}
                    </p>
                    <Link
                      href={printerDetailHref(p.id, printerListReturnTo)}
                      className="mt-1 block truncate font-mono text-xs font-semibold text-[#014171] hover:underline"
                      title={`View printer ${p.serialNumber}`}
                    >
                      {p.serialNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <MonitoringBadge printer={monitoring} />
                    <p className="mt-1.5 truncate text-xs text-slate-500">
                      {monitoring?.reading_id == null ? "—" : monitoring.printer_status ?? "Unknown"}
                    </p>
                  </td>
                  <td className="px-4 py-3"><ConsumableLevel printer={monitoring} /></td>
                  <td className="px-4 py-3">
                    <Badge color={statusBadgeColor(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={printerDetailHref(p.id, printerListReturnTo)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                        <IconGlyph icon={Eye} size={13} />
                        View
                      </Link>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          </>
        )}
      </TableCard>
    </div>
  );
}

function MobileField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 line-clamp-2 font-medium text-slate-700">{value}</p>
    </div>
  );
}

function MonitoringBadge({ printer }: { printer: PrinterMonitoringSnapshot | null }) {
  if (!printer || printer.reading_id === null) return <Badge color="gray">Not Monitored</Badge>;
  if (printer.is_stale) return <Badge color="orange">Stale</Badge>;
  if (printer.online === false) return <Badge color="red">Offline</Badge>;
  if (printer.has_warning) return <Badge color="yellow">Warning</Badge>;
  return <Badge color="green">Online</Badge>;
}

function ConsumableLevel({ printer }: { printer: PrinterMonitoringSnapshot | null }) {
  if (!printer || printer.reading_id === null || printer.consumable_name === null) {
    return <span className="text-slate-400">—</span>;
  }
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
        <p className="max-w-48 truncate text-xs font-medium text-slate-700" title={printer.consumable_name}>
          {printer.consumable_name}
        </p>
        <Badge color="gray">{printer.consumable_status || "Unknown"}</Badge>
      </div>
    );
  }

  const low = printer.consumable_level! <= LOW_CONSUMABLE_THRESHOLD_PERCENT;
  return (
    <div>
      <p className="max-w-48 truncate text-xs font-medium text-slate-700" title={printer.consumable_name}>
        {printer.consumable_name}
      </p>
      <span className={`text-sm font-semibold ${low ? "text-orange-600" : "text-slate-700"}`}>
        {printer.consumable_level}%
      </span>
      {low && <span className="ml-1.5 text-xs text-orange-600">Low</span>}
    </div>
  );
}

function tonerDisplayLabel(
  name: string,
  printer: Pick<PrinterMonitoringSnapshot, "model">,
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

function formatDateTime(value: Date) {
  return value.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}
