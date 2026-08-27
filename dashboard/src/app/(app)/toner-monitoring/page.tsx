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
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { PageHeader, Card, TableCard, Badge, statusBadgeColor, PrimaryButton, SecondaryButton, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
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
  const dateFrom = typeof sp.dateFrom === "string" ? sp.dateFrom : "";
  const dateTo = typeof sp.dateTo === "string" ? sp.dateTo : "";
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
      .select({ id: tonerTypes.id, name: tonerTypes.name, stock: tonerInventory.stock, threshold: tonerInventory.lowStockThreshold })
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
      .orderBy(desc(tonerTransactions.date), desc(tonerTransactions.id)),
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
              <Link href="/toner-monitoring/delivery"><PrimaryButton>+ Delivery Toner</PrimaryButton></Link>
              <Link href="/toner-monitoring/request"><SecondaryButton>+ Request Toner</SecondaryButton></Link>
            </>
          ) : undefined
        }
      />
      <SuccessBanner message={typeof sp.success === "string" ? sp.success : undefined} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {inventoryRows.map((t) => {
          const stock = t.stock ?? 0;
          const threshold = t.threshold ?? 5;
          const low = stock <= threshold;
          return (
            <Card key={t.id} className={`p-4 ${low ? "border-red-300" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[#014171]">{t.name}</p>
                {low && <Badge color="red">Low</Badge>}
              </div>
              <p className="mt-2 text-xl font-bold">{stock} <span className="text-xs font-normal text-slate-400">on hand</span></p>
            </Card>
          );
        })}
      </div>

      <CollapsibleFilterPanel activeFilterCount={activeFilterCount}>
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
              name="ticket"
              defaultValue={ticket}
              placeholder="Search by Ticket and P.O Number"
              aria-label="Search toner transactions"
            />
            <input type="date" name="dateFrom" defaultValue={dateFrom} className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm" />
            <input type="date" name="dateTo" defaultValue={dateTo} className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm" />
            <div className="flex items-end">
              <Link href="/toner-monitoring"><SecondaryButton type="button">Clear</SecondaryButton></Link>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm font-semibold text-[#014171]">Filter options</p>
            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <FilterGroup title="Status" name="status" options={[{ id: "Delivery", name: "Delivery" }, { id: "Request", name: "Request" }]} selected={statusFilters} />
              <FilterGroup title="Toner Type" name="tonerType" options={allTonerTypes} selected={tonerTypeFilters.map(String)} />
              <FilterGroup title="Location" name="location" options={allLocations} selected={locationFilters.map(String)} />
              <FilterGroup title="Department" name="department" options={allDepartments} selected={departmentFilters.map(String)} />
              <FilterGroup title="ITS Names" name="itsName" options={allItsNames} selected={itsNameFilters.map(String)} />
            </div>
          </div>

        </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <TableCard>
        {txnRows.length === 0 ? (
          <EmptyState message="No toner transactions match your filters." />
        ) : (
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Ticket &amp; P.O Reference</th>
                <th className="px-4 py-3">Toner Type</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Location / Department</th>
                <th className="px-4 py-3">ITS Name</th>
                <th className="px-4 py-3">Remarks</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {txnRows.map((t) => (
                <tr key={t.id}>
                  <td className="px-4 py-3"><Badge color={statusBadgeColor(t.type)}>{t.type}</Badge></td>
                  <td className="px-4 py-3">{formatDate(t.date)}</td>
                  <td className="px-4 py-3">{t.ticketReference || "—"}</td>
                  <td className="px-4 py-3">{t.tonerTypeName}</td>
                  <td className="px-4 py-3">{t.quantity}</td>
                  <td className="px-4 py-3">{t.locationName || "—"} / {t.departmentName || "—"}</td>
                  <td className="px-4 py-3">{t.itsName || "—"}</td>
                  <td className="px-4 py-3 max-w-xs truncate" title={t.remarks || ""}>{t.remarks || "—"}</td>
                  <td className="w-px whitespace-nowrap px-4 py-3">
                    {access.toner && (
                      <div className="flex justify-end gap-2">
                        <Link href={`/toner-monitoring/${t.id}/edit`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">Edit</Link>
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
    <div>
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="max-h-32 space-y-1 overflow-y-auto pr-1">
        {options.length === 0 && <p className="text-xs text-slate-400">None</p>}
        {options.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(String(o.id))} />
            {o.name}
          </label>
        ))}
      </div>
    </div>
  );
}
