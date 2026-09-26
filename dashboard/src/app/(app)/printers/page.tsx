import Link from "next/link";
import { db } from "@/db";
import { printers, locations, departments } from "@/db/schema";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { Eye, Printer, SearchX } from "lucide";
import { Badge, PageHeader, TableCard, EmptyState, statusBadgeColor, IconGlyph } from "@/components/ui";
import { requireModuleFullAccess, getModuleAccessMap } from "@/lib/server-utils";
import SuccessBanner from "@/components/SuccessBanner";
import { printerDetailHref } from "@/lib/printer-navigation";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";
import RefreshControl from "@/components/RefreshControl";
import LiveMonitoringBadge from "@/components/LiveMonitoringBadge";
import PrinterRecordsToolbar, { type PrinterRecordSort } from "./PrinterRecordsToolbar";
import PrinterColumnFilter, { type PrinterColumnFilterOption } from "./PrinterColumnFilter";
import RecordPagination, { paginateRecords } from "@/components/RecordPagination";

export const dynamic = "force-dynamic";
const LOW_CONSUMABLE_THRESHOLD_PERCENT = 20;
const AUTO_REFRESH_SECONDS = 60;
const BLANK_FILTER_VALUE = "__blank__";

type PrinterSearchParams = {
  q?: string | string[];
  location?: string | string[];
  model?: string | string[];
  monitoring?: string | string[];
  toner?: string | string[];
  status?: string | string[];
  sort?: string | string[];
  page?: string | string[];
  success?: string | string[];
};

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

type PrinterTableRow = {
  id: number;
  model: string | null;
  locationName: string | null;
  status: string;
};

function printerWebUrl(ipAddress: string) {
  return /^https?:\/\//i.test(ipAddress) ? ipAddress : `http://${ipAddress}`;
}

export default async function PrintersPage({
  searchParams,
}: {
  searchParams: Promise<PrinterSearchParams>;
}) {
  const session = await requireModuleFullAccess("printer_records");
  const access = await getModuleAccessMap(session.id, session.role);
  const params = await searchParams;
  const query = firstParam(params.q).trim();
  const locationFilters = paramList(params.location);
  const modelFilters = paramList(params.model);
  const monitoringFilters = paramList(params.monitoring);
  const tonerFilters = paramList(params.toner);
  const statusFilters = paramList(params.status);
  const requestedSort = firstParam(params.sort);
  const supportedSorts: PrinterRecordSort[] = [
    "newest",
    "oldest",
    "model_asc",
    "model_desc",
    "location_asc",
    "location_desc",
    "monitoring_asc",
    "monitoring_desc",
    "toner_asc",
    "toner_desc",
    "status_asc",
    "status_desc",
  ];
  const sort: PrinterRecordSort = supportedSorts.includes(requestedSort as PrinterRecordSort)
    ? requestedSort as PrinterRecordSort
    : "newest";
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
  const baseRows = await db
    .select({
      id: printers.id,
      ipAddress: printers.ipAddress,
      serialNumber: printers.serialNumber,
      model: printers.model,
      status: printers.status,
      locationId: printers.locationId,
      locationName: locations.name,
      departmentName: departments.name,
    })
    .from(printers)
    .leftJoin(locations, eq(printers.locationId, locations.id))
    .leftJoin(departments, eq(printers.departmentId, departments.id))
    .where(conditions[0])
    .orderBy(desc(printers.id));

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

  const locationOptions = uniqueFilterOptions(baseRows.map((row) => ({
    value: row.locationId === null ? BLANK_FILTER_VALUE : String(row.locationId),
    label: row.locationName?.trim() || "(Blanks)",
  })));
  const modelOptions = uniqueFilterOptions(baseRows.map((row) => ({
    value: filterValue(row.model),
    label: row.model?.trim() || "(Blanks)",
  })));
  const monitoringOptions = uniqueFilterOptions(baseRows.map((row) => {
    const label = monitoringDisplayLabel(monitoringByPrinter.get(row.id) ?? null);
    return { value: label, label };
  }));
  const tonerOptions = uniqueFilterOptions(baseRows.flatMap((row) => {
    const values = tonerFilterValues(monitoringByPrinter.get(row.id) ?? null);
    return values.map((value) => ({ value, label: value === BLANK_FILTER_VALUE ? "(Blanks)" : value }));
  }));
  const statusOptions = uniqueFilterOptions(baseRows.map((row) => ({
    value: row.status,
    label: row.status,
  })));

  const filteredRows = baseRows.filter((row) => {
    const monitoring = monitoringByPrinter.get(row.id) ?? null;
    const locationValue = row.locationId === null ? BLANK_FILTER_VALUE : String(row.locationId);
    const modelValue = filterValue(row.model);
    const monitoringValue = monitoringDisplayLabel(monitoring);
    const tonerValues = tonerFilterValues(monitoring);

    return (
      matchesSelected(locationValue, locationFilters) &&
      matchesSelected(modelValue, modelFilters) &&
      matchesSelected(monitoringValue, monitoringFilters) &&
      (tonerFilters.length === 0 || tonerValues.some((value) => tonerFilters.includes(value))) &&
      matchesSelected(row.status, statusFilters)
    );
  });
  const rows = [...filteredRows].sort((left, right) => comparePrinterRows(
    left,
    right,
    sort,
    monitoringByPrinter,
  ));
  const paginated = paginateRecords(rows, firstParam(params.page));

  const totalCount = await db.select({ count: sql<number>`count(*)::int` }).from(printers);
  const returnParams = new URLSearchParams();
  if (query) returnParams.set("q", query);
  locationFilters.forEach((value) => returnParams.append("location", value));
  modelFilters.forEach((value) => returnParams.append("model", value));
  monitoringFilters.forEach((value) => returnParams.append("monitoring", value));
  tonerFilters.forEach((value) => returnParams.append("toner", value));
  statusFilters.forEach((value) => returnParams.append("status", value));
  if (sort !== "newest") returnParams.set("sort", sort);
  if (paginated.page > 1) returnParams.set("page", String(paginated.page));
  const printerListReturnTo = returnParams.size > 0
    ? `/printers?${returnParams.toString()}`
    : "/printers";

  return (
    <div className="flex h-[calc(100dvh-103px)] min-h-0 flex-col sm:h-[calc(100dvh-111px)]">
      <PageHeader
        parentTitle="Printers"
        title="Printer Records"
        actions={(
          <RefreshControl
            refreshedAtLabel={formatDateTime(renderedAt)}
            intervalSeconds={AUTO_REFRESH_SECONDS}
            iconOnly
          />
        )}
      />

      <SuccessBanner message={firstParam(params.success) || undefined} showInline={false} />

      <TableCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PrinterRecordsToolbar
          query={query}
          sort={sort}
          resultCount={rows.length}
          totalCount={totalCount[0]?.count ?? 0}
          selectedLocations={locationFilters}
          selectedModels={modelFilters}
          selectedMonitoringStatuses={monitoringFilters}
          selectedTonerTypes={tonerFilters}
          selectedStatuses={statusFilters}
          canAddPrinter={Boolean(access.printer_records)}
        />
        <div className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10">
          <>
          <div className="divide-y divide-slate-100 lg:hidden">
            {rows.length === 0 ? (
              <EmptyState message="No printers found" />
            ) : paginated.items.map((p) => {
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
                    aria-label={`View printer ${p.serialNumber}`}
                    title={`View printer ${p.serialNumber}`}
                    className="mt-3 ml-auto flex size-9 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#014171]/30"
                  >
                    <IconGlyph icon={Eye} size={17} />
                  </Link>
                </article>
              );
            })}
          </div>

          <div className="hidden lg:block">
          <table className="w-full min-w-[1040px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[19%]" />
              <col className="w-[13%]" />
              <col className="w-[20%]" />
              <col className="w-[15%]" />
              <col className="w-[15%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
            </colgroup>
            <thead className="bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 leading-4">Location / Department</span>
                    <PrinterColumnFilter
                      label="Location"
                      paramName="location"
                      options={locationOptions}
                      selectedValues={locationFilters}
                      currentSort={sort}
                      sortAscValue="location_asc"
                      sortDescValue="location_desc"
                    />
                  </div>
                </th>
                <th className="whitespace-nowrap px-4 py-3.5">IP Address</th>
                <th className="px-4 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 leading-4">Model / Serial Number</span>
                    <PrinterColumnFilter
                      label="Model"
                      paramName="model"
                      options={modelOptions}
                      selectedValues={modelFilters}
                      currentSort={sort}
                      sortAscValue="model_asc"
                      sortDescValue="model_desc"
                    />
                  </div>
                </th>
                <th className="px-4 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 leading-4">Monitoring Status</span>
                    <PrinterColumnFilter
                      label="Monitoring status"
                      paramName="monitoring"
                      options={monitoringOptions}
                      selectedValues={monitoringFilters}
                      currentSort={sort}
                      sortAscValue="monitoring_asc"
                      sortDescValue="monitoring_desc"
                    />
                  </div>
                </th>
                <th className="px-4 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 leading-4">Toner Type</span>
                    <PrinterColumnFilter
                      label="Toner type"
                      paramName="toner"
                      options={tonerOptions}
                      selectedValues={tonerFilters}
                      currentSort={sort}
                      sortAscValue="toner_asc"
                      sortDescValue="toner_desc"
                    />
                  </div>
                </th>
                <th className="px-4 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 leading-4">Asset Status</span>
                    <PrinterColumnFilter
                      label="Asset status"
                      paramName="status"
                      options={statusOptions}
                      selectedValues={statusFilters}
                      currentSort={sort}
                      sortAscValue="status_asc"
                      sortDescValue="status_desc"
                    />
                  </div>
                </th>
                <th className="whitespace-nowrap px-2 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-sm text-slate-500">
                    <span className="inline-flex flex-col items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                        <IconGlyph icon={SearchX} size={20} />
                      </span>
                      <span>No printers found</span>
                    </span>
                  </td>
                </tr>
              ) : paginated.items.map((p) => {
                const monitoring = monitoringByPrinter.get(p.id) ?? null;
                return (
                <tr key={p.id} className="bg-white transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-2.5">
                    <p className="line-clamp-2 text-xs font-medium text-slate-700">
                      {p.locationName ?? "Unassigned"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {p.departmentName ?? "No department"}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
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
                  <td className="px-4 py-2.5">
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
                  <td className="px-4 py-2.5">
                    <MonitoringBadge printer={monitoring} />
                  </td>
                  <td className="px-4 py-2.5"><ConsumableLevel printer={monitoring} /></td>
                  <td className="px-4 py-2.5">
                    <Badge color={statusBadgeColor(p.status)}>{p.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={printerDetailHref(p.id, printerListReturnTo)}
                        aria-label={`View printer ${p.serialNumber}`}
                        title={`View printer ${p.serialNumber}`}
                        className="inline-flex size-8 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#014171]/30"
                      >
                        <IconGlyph icon={Eye} size={16} />
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
        </div>
        <RecordPagination pathname="/printers" searchParams={params} page={paginated.page} totalPages={paginated.totalPages} total={rows.length} start={paginated.start} />
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
  const label = monitoringDisplayLabel(printer);
  return <LiveMonitoringBadge label={label} color={monitoringStatusColor(label)} />;
}

function monitoringDisplayLabel(printer: PrinterMonitoringSnapshot | null) {
  if (!printer || printer.reading_id === null) return "Not Monitored";
  if (printer.is_stale) return "Stale";
  if (printer.online === false) return "Offline";
  if (printer.has_warning) return "Warning";
  return formatMonitoringStatus(printer.printer_status) || "Online";
}

function formatMonitoringStatus(status: string | null) {
  return status
    ?.trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function monitoringStatusColor(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "offline") return "red" as const;
  if (normalized === "stale") return "orange" as const;
  if (normalized.includes("print") || normalized.includes("process")) return "blue" as const;
  if (["warning", "error", "fault", "jam"].some((value) => normalized.includes(value))) return "yellow" as const;
  if (["idle", "ready", "online", "normal", "standby", "sleep"].some((value) => normalized.includes(value))) return "green" as const;
  return "gray" as const;
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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function paramList(value: string | string[] | undefined) {
  const values = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))];
}

function filterValue(value: string | null) {
  return value?.trim() || BLANK_FILTER_VALUE;
}

function uniqueFilterOptions(options: PrinterColumnFilterOption[]) {
  const unique = new Map<string, PrinterColumnFilterOption>();
  options.forEach((option) => {
    if (!unique.has(option.value)) unique.set(option.value, option);
  });
  return [...unique.values()].sort((left, right) => {
    if (left.value === BLANK_FILTER_VALUE) return -1;
    if (right.value === BLANK_FILTER_VALUE) return 1;
    return left.label.localeCompare(right.label, "en", { numeric: true, sensitivity: "base" });
  });
}

function matchesSelected(value: string, selected: string[]) {
  return selected.length === 0 || selected.includes(value);
}

function tonerFilterValues(printer: PrinterMonitoringSnapshot | null) {
  if (!printer || printer.reading_id === null) return [BLANK_FILTER_VALUE];
  const toners = Array.isArray(printer.toner_consumables) ? printer.toner_consumables : [];
  if (toners.length > 0) {
    return [...new Set(toners.map((toner) => tonerDisplayLabel(toner.name, printer)))];
  }
  if (printer.consumable_name?.trim()) return [printer.consumable_name.trim()];
  return [BLANK_FILTER_VALUE];
}

function comparePrinterRows(
  left: PrinterTableRow,
  right: PrinterTableRow,
  sort: PrinterRecordSort,
  monitoringByPrinter: Map<number, PrinterMonitoringSnapshot>,
) {
  if (sort === "newest") return right.id - left.id;
  if (sort === "oldest") return left.id - right.id;

  let leftValue = "";
  let rightValue = "";
  let descending = false;

  switch (sort) {
    case "location_asc":
    case "location_desc":
      leftValue = left.locationName ?? "";
      rightValue = right.locationName ?? "";
      descending = sort === "location_desc";
      break;
    case "model_asc":
    case "model_desc":
      leftValue = left.model ?? "";
      rightValue = right.model ?? "";
      descending = sort === "model_desc";
      break;
    case "monitoring_asc":
    case "monitoring_desc":
      leftValue = monitoringDisplayLabel(monitoringByPrinter.get(left.id) ?? null);
      rightValue = monitoringDisplayLabel(monitoringByPrinter.get(right.id) ?? null);
      descending = sort === "monitoring_desc";
      break;
    case "toner_asc":
    case "toner_desc":
      leftValue = tonerFilterValues(monitoringByPrinter.get(left.id) ?? null)[0] ?? "";
      rightValue = tonerFilterValues(monitoringByPrinter.get(right.id) ?? null)[0] ?? "";
      descending = sort === "toner_desc";
      break;
    case "status_asc":
    case "status_desc":
      leftValue = left.status;
      rightValue = right.status;
      descending = sort === "status_desc";
      break;
  }

  const result = leftValue.localeCompare(rightValue, "en", { numeric: true, sensitivity: "base" });
  return (descending ? -result : result) || right.id - left.id;
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}
