import Link from "next/link";
import { db } from "@/db";
import { repairTickets, locations, departments } from "@/db/schema";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { PageHeader, Card, TableCard, Badge, statusBadgeColor, PrimaryButton, EmptyState } from "@/components/ui";
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
          <Link href="/repair-history/new">
            <PrimaryButton>+ Report Printer</PrimaryButton>
          </Link>
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
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(18rem,2fr)_minmax(12rem,1fr)_minmax(11rem,1fr)_auto] lg:items-center"
            >
              <SearchInput
                key={searchTerm}
                name="q"
                defaultValue={searchTerm}
                placeholder="Search Ticket or Serial Number"
                aria-label="Search repair tickets"
              />
              <select
                name="location"
                defaultValue={sp.location || ""}
                aria-label="Filter repair tickets by location"
                className="h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 focus:border-[#0b4f7c] focus:ring-2 focus:ring-[#0b4f7c]/15"
              >
                <option value="">All Locations</option>
                {allLocations.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={sp.status || ""}
                aria-label="Filter repair tickets by status"
                className="h-10 min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition hover:bg-slate-50 focus:border-[#0b4f7c] focus:ring-2 focus:ring-[#0b4f7c]/15"
              >
                <option value="">All Statuses</option>
                {REPAIR_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <div className="flex sm:justify-start lg:justify-end">
                <Link
                  href="/repair-history"
                  className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4f7c]/20 sm:w-auto lg:min-w-20"
                >
                  Clear
                </Link>
              </div>
            </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No repair tickets found." />
        ) : (
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
                  <td className="px-4 py-3 font-medium">{t.ticketNumber}</td>
                  <td className="px-4 py-3">{formatDate(t.requestedDate)}</td>
                  <td className="px-4 py-3">{t.serialNumber}</td>
                  <td className="px-4 py-3">
                    <p>{t.locationName || "—"}</p>
                    <p className="text-xs text-slate-400">{t.departmentName || "—"}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate" title={t.problem}>{t.problem}</td>
                  <td className="px-4 py-3">{formatDate(t.dateClosed)}</td>
                  <td className="px-4 py-3"><Badge color={statusBadgeColor(t.status)}>{t.status}</Badge></td>
                  <td className="w-px whitespace-nowrap px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/repair-history/${t.id}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">View</Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
}
