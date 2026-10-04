import Link from "next/link";
import { db } from "@/db";
import {
  tonerTransactions,
  tonerTypes,
  tonerInventory,
  locations,
  departments,
  subunits,
  costCenters,
  itsNames,
} from "@/db/schema";
import { and, asc, desc, eq, ilike } from "drizzle-orm";
import { Droplets, PackagePlus, Pencil, Send } from "lucide";
import { PageHeader, Card, TableCard, Badge, statusBadgeColor, EmptyState, IconGlyph } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import DeleteButton from "@/components/DeleteButton";
import { deleteTransactionAction } from "./actions";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import Search from "@/components/Search";
import RecordTableToolbar from "@/components/RecordTableToolbar";
import PrinterColumnFilter, { type PrinterColumnFilterOption } from "@/app/(app)/printers/PrinterColumnFilter";
import RecordPagination, { paginateRecords } from "@/components/RecordPagination";

export const dynamic = "force-dynamic";
const BLANK_FILTER_VALUE = "__blank__";

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
  const session = await requireModuleFullAccess("toner_monitoring");
  const access = await getModuleAccessMap(session.id, session.role);
  const sp = await searchParams;

  const ticket = firstParam(sp.ticket).trim();
  const statusFilters = paramList(sp.status);
  const dateFilters = paramList(sp.date);
  const tonerFilters = paramList(sp.toner);
  const officeFilters = paramList(sp.office);
  const subunitFilters = paramList(sp.subunit);
  const sort = firstParam(sp.sort);

  const conditions = [];
  if (ticket) conditions.push(ilike(tonerTransactions.ticketReference, `%${ticket}%`));

  const [inventoryRows, baseTxnRows] = await Promise.all([
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
        subunitName: subunits.name,
        costCenterCode: costCenters.code,
        itsName: itsNames.name,
      })
      .from(tonerTransactions)
      .innerJoin(tonerTypes, eq(tonerTransactions.tonerTypeId, tonerTypes.id))
      .leftJoin(locations, eq(tonerTransactions.locationId, locations.id))
      .leftJoin(departments, eq(tonerTransactions.departmentId, departments.id))
      .leftJoin(subunits, eq(tonerTransactions.subunitId, subunits.id))
      .leftJoin(costCenters, eq(tonerTransactions.costCenterId, costCenters.id))
      .leftJoin(itsNames, eq(tonerTransactions.itsNameId, itsNames.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(tonerTransactions.createdAt), desc(tonerTransactions.id)),
  ]);

  const statusOptions = uniqueFilterOptions(baseTxnRows.map((row) => ({ value: row.type, label: row.type })));
  const dateOptions = uniqueFilterOptions(baseTxnRows.map((row) => ({ value: dateFilterValue(row.date), label: formatTonerDate(row.date) })));
  const tonerOptions = uniqueFilterOptions(baseTxnRows.map((row) => ({ value: row.tonerTypeName, label: row.tonerTypeName })));
  const officeOptions = uniqueFilterOptions(baseTxnRows.map((row) => ({
    value: row.locationName?.trim() || BLANK_FILTER_VALUE,
    label: row.locationName?.trim() || "(Blanks)",
  })));
  const subunitOptions = uniqueFilterOptions(baseTxnRows.map((row) => ({
    value: row.subunitName?.trim() || BLANK_FILTER_VALUE,
    label: row.subunitName?.trim() || "(Blanks)",
  })));
  const txnRows = baseTxnRows
    .filter((row) => (
      matchesSelected(row.type, statusFilters)
      && matchesSelected(dateFilterValue(row.date), dateFilters)
      && matchesSelected(row.tonerTypeName, tonerFilters)
      && matchesSelected(row.locationName?.trim() || BLANK_FILTER_VALUE, officeFilters)
      && matchesSelected(row.subunitName?.trim() || BLANK_FILTER_VALUE, subunitFilters)
    ))
    .sort((left, right) => compareTonerRows(left, right, sort));
  const paginated = paginateRecords(txnRows, firstParam(sp.page));

  return (
    <div>
      <PageHeader
        parentTitle="Toners"
        title="Toner Monitoring"
      />
      <SuccessBanner
        message={typeof sp.success === "string" ? sp.success : undefined}
        showInline={false}
      />
      {typeof sp.error === "string" && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Inventory</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Current toner stock</h2>
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

      <TableCard className="mt-7 flex flex-col overflow-hidden">
        <RecordTableToolbar count={txnRows.length} label="transaction">
          <AutoSubmitFilterForm
            method="get"
            resetKey={[statusFilters.join(","), dateFilters.join(","), tonerFilters.join(","), officeFilters.join(","), subunitFilters.join(","), sort].join("|")}
          >
            {statusFilters.map((value) => <input key={`status-${value}`} type="hidden" name="status" value={value} />)}
            {dateFilters.map((value) => <input key={`date-${value}`} type="hidden" name="date" value={value} />)}
            {tonerFilters.map((value) => <input key={`toner-${value}`} type="hidden" name="toner" value={value} />)}
            {officeFilters.map((value) => <input key={`office-${value}`} type="hidden" name="office" value={value} />)}
            {subunitFilters.map((value) => <input key={`subunit-${value}`} type="hidden" name="subunit" value={value} />)}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <Search name="ticket" defaultValue={ticket} placeholder="Ticket or RQ Number" ariaLabel="Search toner transactions" />
          </AutoSubmitFilterForm>
          {access.toner_monitoring && (
            <>
              <Link
                href="/toner-monitoring/delivery"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#00365f]"
              >
                <IconGlyph icon={PackagePlus} size={15} />
                Add Toner
              </Link>
              <Link
                href="/toner-monitoring/request"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
              >
                <IconGlyph icon={Send} size={15} />
                Request Toner
              </Link>
            </>
          )}
        </RecordTableToolbar>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain">
        {txnRows.length === 0 ? (
          <EmptyState message="No toner transactions found" />
        ) : (
          <>
          <div className="divide-y divide-slate-100 lg:hidden">
            {paginated.items.map((t) => (
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
                  <TransactionField label="Ticket or RQ" value={displayReference(t.ticketReference)} mono />
                  <TransactionField label="Office" value={t.locationName || "—"} />
                  <TransactionField label="Department" value={t.departmentName || "—"} />
                  <TransactionField label="Sub-unit" value={t.subunitName || "—"} />
                  <TransactionField label="Cost Center" value={t.costCenterCode || "—"} />
                  <TransactionField label="ITS Name" value={t.itsName || "—"} />
                  <TransactionField label="Remarks" value={t.remarks || "—"} />
                </dl>

                {access.toner_monitoring && (
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
          <table className="w-full table-fixed text-left text-sm">
            <caption className="sr-only">Toner delivery and request records</caption>
            <colgroup>
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[11%]" />
              <col className="w-[12%]" />
              <col className="w-[7%]" />
              <col className="w-[14%]" />
              <col className="w-[18%]" />
              <col className="w-[20%]" />
            </colgroup>
            <thead className="border-b border-slate-200 bg-slate-50/95 text-[11px] uppercase tracking-[0.055em] text-slate-500 backdrop-blur-sm">
              <tr className="whitespace-nowrap">
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Status">
                    <PrinterColumnFilter label="Status" paramName="status" options={statusOptions} selectedValues={statusFilters} currentSort={sort} sortAscValue="status_asc" sortDescValue="status_desc" />
                  </FilterableHeading>
                </th>
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Date">
                    <PrinterColumnFilter label="Date" paramName="date" options={dateOptions} selectedValues={dateFilters} currentSort={sort} sortAscValue="date_asc" sortDescValue="date_desc" sortAscLabel="Oldest first" sortDescLabel="Newest first" />
                  </FilterableHeading>
                </th>
                <th className="px-4 py-3">Ticket or RQ</th>
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Toner">
                    <PrinterColumnFilter label="Toner" paramName="toner" options={tonerOptions} selectedValues={tonerFilters} currentSort={sort} sortAscValue="toner_asc" sortDescValue="toner_desc" />
                  </FilterableHeading>
                </th>
                <th className="px-2 py-3 text-center">Quantity</th>
                <th className="px-3 py-2.5">
                  <FilterableHeading label="Office">
                    <PrinterColumnFilter label="Office" paramName="office" options={officeOptions} selectedValues={officeFilters} currentSort={sort} sortAscValue="office_asc" sortDescValue="office_desc" />
                  </FilterableHeading>
                </th>
                <th className="px-3 py-2.5">
                  <FilterableHeading label="Dept / Sub-unit">
                    <PrinterColumnFilter label="Sub-unit" paramName="subunit" options={subunitOptions} selectedValues={subunitFilters} currentSort={sort} />
                  </FilterableHeading>
                </th>
                <th className="px-4 py-3">ITS Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.items.map((t) => (
                <tr key={t.id} className="align-middle transition-colors even:bg-slate-50/25 hover:bg-sky-50/45">
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
                  <td className="px-2 py-3.5 text-center">
                    <span className="inline-flex min-w-9 justify-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-700">
                      {t.quantity}
                    </span>
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="line-clamp-2 text-xs font-semibold leading-5 text-slate-700" title={t.locationName || ""}>
                      {t.locationName || "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3.5">
                    <p className="line-clamp-1 font-medium leading-5 text-slate-700" title={t.departmentName || ""}>
                      {t.departmentName || "—"}
                    </p>
                    <p className="mt-0.5 line-clamp-1 text-xs leading-4 text-slate-400" title={t.subunitName || ""}>
                      {t.subunitName || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                        {t.itsName || <span className="text-slate-300">—</span>}
                      </span>
                    {access.toner_monitoring && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Link href={`/toner-monitoring/${t.id}/edit`} aria-label={`Edit ${t.tonerTypeName} transaction`} className="inline-flex size-10 items-center justify-center rounded-lg text-[#014171] transition hover:bg-slate-100">
                          <IconGlyph icon={Pencil} size={16} />
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
        </div>
        <RecordPagination pathname="/toner-monitoring" searchParams={sp} page={paginated.page} totalPages={paginated.totalPages} total={txnRows.length} start={paginated.start} />
      </TableCard>
    </div>
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

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function paramList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function uniqueFilterOptions(options: PrinterColumnFilterOption[]) {
  return [...new Map(options.map((option) => [option.value, option])).values()]
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
}

function matchesSelected(value: string, selected: string[]) {
  return selected.length === 0 || selected.includes(value);
}

function dateFilterValue(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function compareTonerRows(
  left: { type: string; date: string | Date; tonerTypeName: string; locationName: string | null; id: number },
  right: { type: string; date: string | Date; tonerTypeName: string; locationName: string | null; id: number },
  sort: string,
) {
  const values: Record<string, [string, string]> = {
    status_asc: [left.type, right.type],
    status_desc: [right.type, left.type],
    date_asc: [dateFilterValue(left.date), dateFilterValue(right.date)],
    date_desc: [dateFilterValue(right.date), dateFilterValue(left.date)],
    toner_asc: [left.tonerTypeName, right.tonerTypeName],
    toner_desc: [right.tonerTypeName, left.tonerTypeName],
    office_asc: [left.locationName ?? "", right.locationName ?? ""],
    office_desc: [right.locationName ?? "", left.locationName ?? ""],
  };
  const pair = values[sort];
  return pair ? pair[0].localeCompare(pair[1], undefined, { numeric: true }) || right.id - left.id : 0;
}

function TransactionField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 line-clamp-2 text-xs font-medium text-slate-700 ${mono ? "font-mono" : ""}`}>{value}</dd>
    </div>
  );
}
