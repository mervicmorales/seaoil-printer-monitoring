import Link from "next/link";
import { db } from "@/db";
import { printers, locations, departments } from "@/db/schema";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { PageHeader, TableCard, EmptyState } from "@/components/ui";
import { requireSession, getModuleAccessMap } from "@/lib/server-utils";
import { PRINTER_STATUSES } from "@/lib/constants";
import SuccessBanner from "@/components/SuccessBanner";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import { printerDetailHref } from "@/lib/printer-navigation";
import CollapsibleFilterPanel from "@/components/CollapsibleFilterPanel";
import SearchInput from "@/components/SearchInput";

export const dynamic = "force-dynamic";

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

  const conditions = [];
  if (query) {
    conditions.push(
      or(
        ilike(printers.serialNumber, `%${query}%`),
        ilike(printers.assetTag, `%${query}%`),
        ilike(printers.ipAddress, `%${query}%`),
        ilike(printers.brand, `%${query}%`),
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
      brand: printers.brand,
      model: printers.model,
      locationName: locations.name,
      departmentName: departments.name,
    })
    .from(printers)
    .leftJoin(locations, eq(printers.locationId, locations.id))
    .leftJoin(departments, eq(printers.departmentId, departments.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(printers.id));

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
        actions={
          access.printers ? (
            <Link
              href="/printers/new"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#012c50]"
            >
              + Add Printer
            </Link>
          ) : undefined
        }
      />

      <SuccessBanner message={params.success} />

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
            placeholder="Serial, asset tag, IP, brand, model, location or department"
            aria-label="Search printers"
          />
          <select name="status" defaultValue={params.status || ""} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm">
            <option value="">All Statuses</option>
            {PRINTER_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select name="location" defaultValue={params.location || ""} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm">
            <option value="">All Locations</option>
            {allLocations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <Link href="/printers" className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Clear
          </Link>
        </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No printers found. Try adjusting your filters or add a new printer." />
        ) : (
          <table className="w-full min-w-[610px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[190px]" />
              <col className="w-[175px]" />
              <col className="w-[170px]" />
              <col className="w-[75px]" />
            </colgroup>
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">Location / Department</th>
                <th className="whitespace-nowrap px-4 py-3">IP / Serial Number</th>
                <th className="whitespace-nowrap px-4 py-3">Brand / Model</th>
                <th className="whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <p>{p.locationName || "—"}</p>
                    <p className="text-xs text-slate-400">{p.departmentName || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    {p.ipAddress ? (
                      <a
                        href={printerWebUrl(p.ipAddress)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#014171] hover:underline"
                      >
                        {p.ipAddress}
                      </a>
                    ) : (
                      <p className="font-medium text-slate-800">—</p>
                    )}
                    <p className="text-xs text-slate-400">{p.serialNumber}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{p.brand}</p>
                    <p className="text-xs text-slate-400">{p.model}</p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={printerDetailHref(p.id, printerListReturnTo)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">View</Link>
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
