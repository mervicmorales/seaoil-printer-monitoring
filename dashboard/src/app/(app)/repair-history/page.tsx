import Link from "next/link";
import { db } from "@/db";
import { repairTickets, locations, departments } from "@/db/schema";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Eye, Plus, Wrench, X } from "lucide";
import { PageHeader, TableCard, Badge, statusBadgeColor, EmptyState, IconGlyph } from "@/components/ui";
import { formatDate } from "@/lib/format";
import SuccessBanner from "@/components/SuccessBanner";
import { REPAIR_STATUSES } from "@/lib/constants";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import CollapsibleFilterPanel from "@/components/CollapsibleFilterPanel";
import SearchInput from "@/components/SearchInput";

export const dynamic = "force-dynamic";

export default async function RepairHistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const sp = await searchParams;

  const conditions = [];
  const searchTerm = (sp.q || sp.ticket || sp.serial || "").trim();
  if (searchTerm) {
    conditions.push(
      or(
        ilike(repairTickets.ticketNumber, `%${searchTerm}%`),
        ilike(repairTickets.serialNumber, `%${searchTerm}%`),
      ),
    );
  }
  if (sp.status) conditions.push(eq(repairTickets.status, sp.status));
  if (sp.location) conditions.push(eq(repairTickets.locationId, Number(sp.location)));

  const rows = await db
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

  const allLocations = await db.select().from(locations).orderBy(asc(locations.name));
  const activeFilterCount = [
    searchTerm,
    sp.status,
    sp.location,
  ].filter(Boolean).length;

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader
        title="Repair History"
        subtitle={`${rows.length} ticket(s) in the repair summary`}
        actions={
          access.repair ? (
            <Link
              href="/repair-history/new"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md"
            >
              <IconGlyph icon={Plus} size={16} />
              Report Printer
            </Link>
          ) : undefined
        }
      />
      <SuccessBanner message={sp.success} showInline={false} />

      <CollapsibleFilterPanel activeFilterCount={activeFilterCount}>
            <AutoSubmitFilterForm
              method="get"
              resetKey={[
                sp.q,
                sp.status,
                sp.location,
              ].join("|")}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(18rem,2fr)_minmax(12rem,1fr)_minmax(11rem,1fr)_auto] lg:items-end"
            >
              <SearchInput
                key={searchTerm}
                label="Ticket or serial number"
                name="q"
                defaultValue={searchTerm}
                placeholder="Search Ticket or Serial Number"
                aria-label="Search repair tickets"
              />
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Location</span>
                <select
                  name="location"
                  defaultValue={sp.location || ""}
                  aria-label="Filter repair tickets by location"
                  className="h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 hover:bg-slate-50 focus:border-[#0b4f7c] focus:ring-2 focus:ring-[#0b4f7c]/15"
                >
                  <option value="">All Locations</option>
                  {allLocations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Ticket status</span>
                <select
                  name="status"
                  defaultValue={sp.status || ""}
                  aria-label="Filter repair tickets by status"
                  className="h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 hover:bg-slate-50 focus:border-[#0b4f7c] focus:ring-2 focus:ring-[#0b4f7c]/15"
                >
                  <option value="">All Statuses</option>
                  {REPAIR_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <div className="flex sm:justify-start lg:justify-end">
                <Link
                  href="/repair-history"
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4f7c]/20 sm:w-auto lg:min-w-20"
                >
                  <IconGlyph icon={X} size={14} />
                  Clear
                </Link>
              </div>
            </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Service activity</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Repair tickets</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {rows.length} records
        </span>
      </div>

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No repair tickets found." />
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
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Ticket #</th>
                <th className="px-4 py-3">Requested Date</th>
                <th className="px-4 py-3">Serial Number</th>
                <th className="px-4 py-3">Location / Department</th>
                <th className="px-4 py-3">Concern</th>
                <th className="px-4 py-3">Date Closed</th>
                <th className="px-4 py-3">Ticket Status</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((t) => (
                <tr key={t.id}>
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
                      <Link href={`/repair-history/${t.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
                        <IconGlyph icon={Eye} size={13} />
                        View
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
