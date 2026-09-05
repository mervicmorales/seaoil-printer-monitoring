import Link from "next/link";
import { db } from "@/db";
import {
  tonerTransactions,
  tonerTypes,
  tonerInventory,
  locations,
  departments,
  itsNames,
} from "@/db/schema";
import { and, asc, desc, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import { CalendarDays, Droplets, Filter, PackagePlus, Pencil, Send, X } from "lucide";
import { PageHeader, Card, TableCard, Badge, statusBadgeColor, EmptyState, IconGlyph } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import DeleteButton from "@/components/DeleteButton";
import { deleteTransactionAction } from "./actions";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import CollapsibleFilterPanel from "@/components/CollapsibleFilterPanel";
import SearchInput from "@/components/SearchInput";

export const dynamic = "force-dynamic";

function toArray(v: string | string[] | undefined) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function todayInManila() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function formatTonerDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const dateOnly = typeof value === "string" ? /^(\d{4})-(\d{2})-(\d{2})/.exec(value) : null;
  const date = dateOnly
    ? new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: dateOnly ? "UTC" : "Asia/Manila",
  }).format(date);
}

function displayReference(value: string | null) {
  const normalized = value?.trim().toUpperCase();
  return !normalized || normalized === "NA" || normalized === "N/A" ? "—" : value!.trim();
}

export default async function TonerMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const sp = await searchParams;

  const statusFilters = toArray(sp.status);
  const tonerTypeFilters = toArray(sp.tonerType).map(Number);
  const locationFilters = toArray(sp.location).map(Number);
  const departmentFilters = toArray(sp.department).map(Number);
  const itsNameFilters = toArray(sp.itsName).map(Number);
  const ticket = typeof sp.ticket === "string" ? sp.ticket.trim() : "";
  const today = todayInManila();
  const currentYearStart = `${today.slice(0, 4)}-01-01`;
  const dateFrom = typeof sp.dateFrom === "string"
    ? sp.dateFrom
    : sp.dateFrom === undefined
      ? currentYearStart
      : "";
  const dateTo = typeof sp.dateTo === "string"
    ? sp.dateTo
    : sp.dateTo === undefined
      ? today
      : "";
  const activeFilterCount =
    [ticket, dateFrom, dateTo].filter(Boolean).length +
    statusFilters.length +
    tonerTypeFilters.length +
    locationFilters.length +
    departmentFilters.length +
    itsNameFilters.length;

  const conditions = [];
  if (statusFilters.length) conditions.push(inArray(tonerTransactions.type, statusFilters));
  if (tonerTypeFilters.length) conditions.push(inArray(tonerTransactions.tonerTypeId, tonerTypeFilters));
  if (locationFilters.length) conditions.push(inArray(tonerTransactions.locationId, locationFilters));
  if (departmentFilters.length) conditions.push(inArray(tonerTransactions.departmentId, departmentFilters));
  if (itsNameFilters.length) conditions.push(inArray(tonerTransactions.itsNameId, itsNameFilters));
  if (ticket) conditions.push(ilike(tonerTransactions.ticketReference, `%${ticket}%`));
  if (dateFrom) conditions.push(gte(tonerTransactions.date, dateFrom));
  if (dateTo) conditions.push(lte(tonerTransactions.date, dateTo));

  const [inventoryRows, txnRows, allTonerTypes, allLocations, allDepartments, allItsNames] = await Promise.all([
    db
      .select({ id: tonerTypes.id, name: tonerTypes.name, stock: tonerInventory.stock, threshold: tonerInventory.lowStockThreshold, criticalThreshold: tonerInventory.criticalStockThreshold })
      .from(tonerTypes)
      .leftJoin(tonerInventory, eq(tonerInventory.tonerTypeId, tonerTypes.id))
      .where(eq(tonerTypes.showAlertCard, true))
      .orderBy(asc(tonerTypes.name)),
    db
      .select({
        id: tonerTransactions.id,
        type: tonerTransactions.type,
        date: tonerTransactions.date,
        ticketReference: tonerTransactions.ticketReference,
        quantity: tonerTransactions.quantity,
        remarks: tonerTransactions.remarks,
        tonerTypeName: tonerTypes.name,
        locationName: locations.name,
        departmentName: departments.name,
        itsName: itsNames.name,
      })
      .from(tonerTransactions)
      .innerJoin(tonerTypes, eq(tonerTransactions.tonerTypeId, tonerTypes.id))
      .leftJoin(locations, eq(tonerTransactions.locationId, locations.id))
      .leftJoin(departments, eq(tonerTransactions.departmentId, departments.id))
      .leftJoin(itsNames, eq(tonerTransactions.itsNameId, itsNames.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tonerTransactions.createdAt), desc(tonerTransactions.id)),
    db.select().from(tonerTypes).orderBy(asc(tonerTypes.name)),
    db.select().from(locations).orderBy(asc(locations.name)),
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select().from(itsNames).orderBy(asc(itsNames.name)),
  ]);

  return (
    <div>
      <PageHeader
        title="Toner Monitoring"
        subtitle="Track toner inventory levels, deliveries and requests."
        actions={
          access.toner ? (
            <>
              <Link
                href="/toner-monitoring/delivery"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md"
              >
                <IconGlyph icon={PackagePlus} size={16} />
                Add Toner
              </Link>
              <Link
                href="/toner-monitoring/request"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                <IconGlyph icon={Send} size={15} />
                Request Toner
              </Link>
            </>
          ) : undefined
        }
      />
      <SuccessBanner
        message={typeof sp.success === "string" ? sp.success : undefined}
        showInline={false}
      />

      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Inventory</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Current toner stock</h2>
          <p className="mt-1 text-xs text-slate-500">On-hand quantities and stock health by toner type.</p>
        </div>
        <span className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm sm:inline-flex">
          {inventoryRows.length} toner types
        </span>
      </div>

      <section aria-label="Toner inventory" className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {inventoryRows.length === 0 ? (
          <Card className="p-8 text-center text-sm text-slate-500 sm:col-span-2 lg:col-span-4">
            No toner types are currently configured for inventory alerts.
          </Card>
        ) : inventoryRows.map((t) => {
          const stock = t.stock ?? 0;
          const threshold = t.threshold ?? 5;
          const criticalThreshold = t.criticalThreshold ?? 2;
          const status = stock <= 0 ? "Empty" : stock <= criticalThreshold ? "Critical" : stock <= threshold ? "Low" : null;
          const attentionClasses = status === "Low"
            ? "border-amber-200 bg-amber-50/20"
            : status
              ? "border-red-200 bg-red-50/20"
              : "";
          const accentClass = status === "Low" ? "bg-amber-500" : status ? "bg-red-500" : "bg-emerald-500";
          const iconClass = status === "Low"
            ? "bg-amber-50 text-amber-600"
            : status
              ? "bg-red-50 text-red-600"
              : "bg-emerald-50 text-emerald-600";
          return (
            <Card key={t.id} className={`relative min-h-28 overflow-hidden p-4 ${attentionClasses}`}>
              <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${accentClass}`} />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
                    <IconGlyph icon={Droplets} size={16} />
                  </span>
                  <p className="truncate text-sm font-semibold text-[#014171]" title={t.name}>{t.name}</p>
                </div>
                {status && <Badge color={status === "Low" ? "yellow" : "red"}>{status}</Badge>}
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3.5">
                <p className="text-2xl font-bold leading-none tracking-[-0.025em] text-slate-900">{stock} <span className="text-xs font-semibold tracking-normal text-slate-500">on hand</span></p>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Low at {threshold}</p>
              </div>
            </Card>
          );
        })}
      </section>

      <CollapsibleFilterPanel activeFilterCount={activeFilterCount} defaultOpen={false}>
        <AutoSubmitFilterForm
          method="get"
          resetKey={[
            ticket,
            dateFrom,
            dateTo,
            statusFilters.join(","),
            tonerTypeFilters.join(","),
            locationFilters.join(","),
            departmentFilters.join(","),
            itsNameFilters.join(","),
          ].join("|")}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <SearchInput
              key={ticket}
              label="Ticket or P.O reference"
              name="ticket"
              defaultValue={ticket}
              placeholder="Search by Ticket and P.O Number"
              aria-label="Search toner transactions"
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Date from</span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconGlyph icon={CalendarDays} size={15} /></span>
                <input type="date" name="dateFrom" defaultValue={dateFrom} className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15" />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Date to</span>
              <span className="relative block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconGlyph icon={CalendarDays} size={15} /></span>
                <input type="date" name="dateTo" defaultValue={dateTo} className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15" />
              </span>
            </label>
            <div className="flex items-end">
              <Link href="/toner-monitoring" className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 lg:w-auto">
                <IconGlyph icon={X} size={14} />
                Clear
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-[#014171]">
                <IconGlyph icon={Filter} size={15} />
              </span>
              <div>
                <p className="text-sm font-bold text-[#014171]">Filter options</p>
                <p className="text-xs text-slate-500">Select one or more values in each category.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <FilterGroup title="Status" name="status" options={[{ id: "Delivery", name: "Delivery" }, { id: "Request", name: "Request" }]} selected={statusFilters} />
              <FilterGroup title="Toner Type" name="tonerType" options={allTonerTypes} selected={tonerTypeFilters.map(String)} />
              <FilterGroup title="Location" name="location" options={allLocations} selected={locationFilters.map(String)} />
              <FilterGroup title="Department" name="department" options={allDepartments} selected={departmentFilters.map(String)} />
              <FilterGroup title="ITS Names" name="itsName" options={allItsNames} selected={itsNameFilters.map(String)} />
            </div>
          </div>

        </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <div className="mb-3 mt-7 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Activity</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Toner transactions</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {txnRows.length} records
        </span>
      </div>

      <TableCard>
        {txnRows.length === 0 ? (
          <EmptyState message="No toner transactions match your filters." />
        ) : (
          <>
          <div className="divide-y divide-slate-100 lg:hidden">
            {txnRows.map((t) => (
              <article key={t.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{t.tonerTypeName}</p>
                    <time dateTime={t.date} className="mt-1 block text-xs font-medium tabular-nums text-slate-500">
                      {formatTonerDate(t.date)}
                    </time>
                  </div>
                  <Badge color={statusBadgeColor(t.type)}>{t.type}</Badge>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                  <TransactionField label="Quantity" value={String(t.quantity)} />
                  <TransactionField label="Ticket / P.O" value={displayReference(t.ticketReference)} mono />
                  <TransactionField label="Location" value={t.locationName || "—"} />
                  <TransactionField label="Department" value={t.departmentName || "—"} />
                  <TransactionField label="ITS Name" value={t.itsName || "—"} />
                  <TransactionField label="Remarks" value={t.remarks || "—"} />
                </dl>

                {access.toner && (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={`/toner-monitoring/${t.id}/edit`} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
                      <IconGlyph icon={Pencil} size={13} />
                      Edit
                    </Link>
                    <DeleteButton
                      action={deleteTransactionAction}
                      id={t.id}
                      title="Delete transaction?"
                      confirmText="This transaction will be permanently removed and the toner inventory will be adjusted automatically."
                      confirmLabel="Delete transaction"
                      className="w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
                    />
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="hidden lg:block">
          <table className="w-full min-w-[1360px] table-fixed text-left text-sm">
            <caption className="sr-only">Toner delivery and request records</caption>
            <colgroup>
              <col className="w-[110px]" />
              <col className="w-[130px]" />
              <col className="w-[140px]" />
              <col className="w-[150px]" />
              <col className="w-[100px]" />
              <col className="w-[210px]" />
              <col className="w-[130px]" />
              <col />
              <col className="w-[170px]" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50/95 text-[11px] uppercase tracking-[0.055em] text-slate-500 backdrop-blur-sm">
              <tr className="whitespace-nowrap">
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Ticket &amp; P.O</th>
                <th className="px-4 py-3">Toner</th>
                <th className="px-4 py-3 text-center">Quantity</th>
                <th className="px-4 py-3">Location / Department</th>
                <th className="px-4 py-3">ITS Name</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txnRows.map((t) => (
                <tr key={t.id} className="align-top transition-colors even:bg-slate-50/25 hover:bg-sky-50/45">
                  <td className="px-4 py-3.5"><Badge color={statusBadgeColor(t.type)}>{t.type}</Badge></td>
                  <td className="px-4 py-3.5">
                    <time dateTime={t.date} className="whitespace-nowrap font-semibold tabular-nums text-slate-700">
                      {formatTonerDate(t.date)}
                    </time>
                  </td>
                  <td className="px-4 py-3.5">
                    {displayReference(t.ticketReference) === "—" ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="inline-flex max-w-full rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-medium text-slate-600" title={t.ticketReference || ""}>
                        <span className="truncate">{displayReference(t.ticketReference)}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-semibold leading-5 text-slate-800">{t.tonerTypeName}</td>
                  <td className="px-4 py-3.5 text-center">
                    <span className="inline-flex min-w-9 justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
                      {t.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="line-clamp-2 font-medium leading-5 text-slate-700" title={t.locationName || t.departmentName || ""}>
                      {t.locationName || t.departmentName || "—"}
                    </p>
                    {t.locationName && t.departmentName && (
                      <p className="mt-0.5 line-clamp-1 text-xs leading-4 text-slate-400" title={t.departmentName}>{t.departmentName}</p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-700">{t.itsName || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3.5">
                    <p className="line-clamp-2 break-words text-xs leading-5 text-slate-600" title={t.remarks || ""}>
                      {t.remarks || <span className="text-slate-300">—</span>}
                    </p>
                  </td>
                  <td className="w-px whitespace-nowrap px-4 py-3.5">
                    {access.toner && (
                      <div className="flex justify-end gap-2">
                        <Link href={`/toner-monitoring/${t.id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                          <IconGlyph icon={Pencil} size={13} />
                          Edit
                        </Link>
                        <DeleteButton
                          action={deleteTransactionAction}
                          id={t.id}
                          title="Delete transaction?"
                          confirmText="This transaction will be permanently removed and the toner inventory will be adjusted automatically."
                          confirmLabel="Delete transaction"
                        />
                      </div>
                    )}
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

function FilterGroup({
  title,
  name,
  options,
  selected,
}: {
  title: string;
  name: string;
  options: { id: number | string; name: string }[];
  selected: string[];
}) {
  return (
    <fieldset className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
      <legend className="px-1 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-500">{title}</legend>
      <div className="mt-1 max-h-32 space-y-1.5 overflow-y-auto pr-1">
        {options.length === 0 && <p className="text-xs text-slate-400">None</p>}
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-white">
            <input className="size-3.5 rounded border-slate-300" type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(String(o.id))} />
            <span className="min-w-0 truncate" title={o.name}>{o.name}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function TransactionField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 line-clamp-2 text-xs font-medium text-slate-700 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
