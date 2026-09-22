import Link from "next/link";
import { db } from "@/db";
import { repairTickets, locations, departments } from "@/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Eye, Plus, Wrench } from "lucide";
import { PageHeader, TableCard, Badge, statusBadgeColor, EmptyState, IconGlyph } from "@/components/ui";
import { formatDate } from "@/lib/format";
import SuccessBanner from "@/components/SuccessBanner";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import Search from "@/components/Search";
import RecordTableToolbar from "@/components/RecordTableToolbar";
import PrinterColumnFilter, { type PrinterColumnFilterOption } from "@/app/(app)/printers/PrinterColumnFilter";

export const dynamic = "force-dynamic";
const BLANK_FILTER_VALUE = "__blank__";

export default async function RepairHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireModuleFullAccess("repair");
  const access = await getModuleAccessMap(session.id, session.role);
  const sp = await searchParams;

  const conditions = [];
  const searchTerm = (firstParam(sp.q) || firstParam(sp.ticket) || firstParam(sp.serial)).trim();
  const requestedDateFilters = paramList(sp.requestedDate);
  const departmentFilters = paramList(sp.department);
  const statusFilters = paramList(sp.status);
  const sort = firstParam(sp.sort);
  if (searchTerm) {
    conditions.push(
      or(
        ilike(repairTickets.ticketNumber, `%${searchTerm}%`),
        ilike(repairTickets.serialNumber, `%${searchTerm}%`),
      ),
    );
  }

  const baseRows = await db
    .select({
      id: repairTickets.id,
      ticketNumber: repairTickets.ticketNumber,
      requestedDate: repairTickets.requestedDate,
      serialNumber: repairTickets.serialNumber,
      departmentName: departments.name,
      locationName: locations.name,
      problem: repairTickets.problem,
      dateClosed: repairTickets.dateClosed,
      status: repairTickets.status,
    })
    .from(repairTickets)
    .leftJoin(departments, eq(repairTickets.departmentId, departments.id))
    .leftJoin(locations, eq(repairTickets.locationId, locations.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(
      desc(sql<boolean>`${repairTickets.status} = 'Open'`),
      desc(repairTickets.updatedAt),
      desc(repairTickets.createdAt),
    );
  const requestedDateOptions = uniqueFilterOptions(baseRows.map((row) => ({
    value: dateFilterValue(row.requestedDate),
    label: formatDate(row.requestedDate),
  })));
  const departmentOptions = uniqueFilterOptions(baseRows.map((row) => ({
    value: row.departmentName?.trim() || BLANK_FILTER_VALUE,
    label: row.departmentName?.trim() || "(Blanks)",
  })));
  const statusOptions = uniqueFilterOptions(baseRows.map((row) => ({ value: row.status, label: row.status })));
  const rows = baseRows
    .filter((row) => (
      matchesSelected(dateFilterValue(row.requestedDate), requestedDateFilters)
      && matchesSelected(row.departmentName?.trim() || BLANK_FILTER_VALUE, departmentFilters)
      && matchesSelected(row.status, statusFilters)
    ))
    .sort((left, right) => compareRepairRows(left, right, sort));

  return (
    <div className="flex h-[calc(100dvh-103px)] min-h-0 flex-col sm:h-[calc(100dvh-111px)]">
      <PageHeader
        parentTitle="Printers"
        title="Repair History"
      />
      <SuccessBanner message={firstParam(sp.success) || undefined} showInline={false} />

      <TableCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <RecordTableToolbar count={rows.length} label="repair ticket">
          <AutoSubmitFilterForm
            method="get"
            resetKey={[requestedDateFilters.join(","), departmentFilters.join(","), statusFilters.join(","), sort].join("|")}
          >
            {requestedDateFilters.map((value) => <input key={`requested-date-${value}`} type="hidden" name="requestedDate" value={value} />)}
            {departmentFilters.map((value) => <input key={`department-${value}`} type="hidden" name="department" value={value} />)}
            {statusFilters.map((value) => <input key={`status-${value}`} type="hidden" name="status" value={value} />)}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <Search name="q" defaultValue={searchTerm} placeholder="Ticket or serial number" ariaLabel="Search repair tickets" />
          </AutoSubmitFilterForm>
          {access.repair && (
            <Link href="/repair-history/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#00365f]">
              <IconGlyph icon={Plus} size={15} />
              Report Printer
            </Link>
          )}
        </RecordTableToolbar>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No repair tickets found" />
        ) : (
          <>
          <div className="divide-y divide-slate-100 lg:hidden">
            {rows.map((t) => (
              <article key={t.id} className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                      <IconGlyph icon={Wrench} size={17} />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-bold text-[#014171]">{t.ticketNumber}</p>
                      <p className="mt-1 text-xs font-medium text-slate-500">Requested {formatDate(t.requestedDate)}</p>
                    </div>
                  </div>
                  <Badge color={statusBadgeColor(t.status)}>{t.status}</Badge>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
                  <TicketField label="Serial number" value={t.serialNumber} mono />
                  <TicketField label="Date closed" value={formatDate(t.dateClosed)} />
                  <TicketField label="Location" value={t.locationName || "—"} />
                  <TicketField label="Department" value={t.departmentName || "—"} />
                  <div className="col-span-2"><TicketField label="Concern" value={t.problem} /></div>
                </dl>

                <Link href={`/repair-history/${t.id}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
                  <IconGlyph icon={Eye} size={14} />
                  View ticket
                </Link>
              </article>
            ))}
          </div>

          <div className="hidden lg:block">
          <table className="w-full min-w-[950px] text-left text-sm">
            <thead className="bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Requested Date">
                    <PrinterColumnFilter label="Requested date" paramName="requestedDate" options={requestedDateOptions} selectedValues={requestedDateFilters} currentSort={sort} sortAscValue="requested_date_asc" sortDescValue="requested_date_desc" sortAscLabel="Oldest first" sortDescLabel="Newest first" />
                  </FilterableHeading>
                </th>
                <th className="px-4 py-3">Serial Number</th>
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Location / Department">
                    <PrinterColumnFilter label="Department" paramName="department" options={departmentOptions} selectedValues={departmentFilters} currentSort={sort} sortAscValue="department_asc" sortDescValue="department_desc" />
                  </FilterableHeading>
                </th>
                <th className="px-4 py-3">Concern</th>
                <th className="px-4 py-3">Date Closed</th>
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Ticket Status">
                    <PrinterColumnFilter label="Ticket status" paramName="status" options={statusOptions} selectedValues={statusFilters} currentSort={sort} sortAscValue="status_asc" sortDescValue="status_desc" />
                  </FilterableHeading>
                </th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-xs font-bold text-[#014171]">{t.ticketNumber}</td>
                  <td className="px-4 py-3">{formatDate(t.requestedDate)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{t.serialNumber}</td>
                  <td className="px-4 py-3">
                    <p>{t.locationName || "—"}</p>
                    <p className="text-xs text-slate-400">{t.departmentName || "—"}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={t.problem}>{t.problem}</td>
                  <td className="px-4 py-3">{formatDate(t.dateClosed)}</td>
                  <td className="px-4 py-3"><Badge color={statusBadgeColor(t.status)}>{t.status}</Badge></td>
                  <td className="w-px whitespace-nowrap px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/repair-history/${t.id}`} aria-label={`View ticket ${t.ticketNumber}`} className="inline-flex size-8 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100">
                        <IconGlyph icon={Eye} size={16} />
                      </Link>
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
      </TableCard>
    </div>
  );
}

function TicketField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className={`mt-1 line-clamp-2 text-xs font-medium text-slate-700 ${mono ? "font-mono" : ""}`}>{value}</dd>
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

function compareRepairRows(
  left: { requestedDate: string | Date; departmentName: string | null; status: string },
  right: { requestedDate: string | Date; departmentName: string | null; status: string },
  sort: string,
) {
  const values: Record<string, [string, string]> = {
    requested_date_asc: [dateFilterValue(left.requestedDate), dateFilterValue(right.requestedDate)],
    requested_date_desc: [dateFilterValue(right.requestedDate), dateFilterValue(left.requestedDate)],
    department_asc: [left.departmentName ?? "", right.departmentName ?? ""],
    department_desc: [right.departmentName ?? "", left.departmentName ?? ""],
    status_asc: [left.status, right.status],
    status_desc: [right.status, left.status],
  };
  const pair = values[sort];
  return pair ? pair[0].localeCompare(pair[1], undefined, { numeric: true }) : 0;
}
