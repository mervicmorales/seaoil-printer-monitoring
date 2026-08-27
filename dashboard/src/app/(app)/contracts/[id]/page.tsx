import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { contracts, vendors, printers, locations, departments } from "@/db/schema";
import { and, eq, ilike } from "drizzle-orm";
import { PageHeader, Card, TableCard, SecondaryButton, EmptyState, Badge, statusBadgeColor } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import SearchInput from "@/components/SearchInput";

export default async function ViewContractPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ serial?: string }>;
}) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const { id } = await params;
  const sp = await searchParams;
  const serial = sp.serial?.trim() ?? "";

  const rows = await db
    .select({ contract: contracts, vendorName: vendors.name, vendorEmail: vendors.email })
    .from(contracts)
    .leftJoin(vendors, eq(contracts.vendorId, vendors.id))
    .where(eq(contracts.id, Number(id)))
    .limit(1);
  const record = rows[0];
  if (!record) notFound();

  const linkedPrinters = await db
    .select({
      id: printers.id,
      serialNumber: printers.serialNumber,
      brand: printers.brand,
      model: printers.model,
      locationName: locations.name,
      departmentName: departments.name,
      status: printers.status,
    })
    .from(printers)
    .leftJoin(locations, eq(printers.locationId, locations.id))
    .leftJoin(departments, eq(printers.departmentId, departments.id))
    .where(and(eq(printers.contractId, Number(id)), serial ? ilike(printers.serialNumber, `%${serial}%`) : undefined));

  const c = record.contract;

  return (
    <div>
      <PageHeader
        title={`Contract ${c.contractNumber}`}
        subtitle="Contract details and linked printers."
        actions={
          <>
            {access.contract && <Link href={`/contracts/${c.id}/edit`}><SecondaryButton>Update Contract</SecondaryButton></Link>}
            <Link href="/contracts"><SecondaryButton>Back to List</SecondaryButton></Link>
          </>
        }
      />

      <Card className="mb-6 p-6">
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Vendor / Supplier" value={record.vendorName || "—"} />
          <Field label="Contract Start" value={formatDate(c.startDate)} />
          <Field label="Contract End / Renewal" value={formatDate(c.endDate)} />
          <Field label="Notes" value={c.notes || "—"} />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Contract Document</p>
            {c.documentUrl ? (
              <a href={c.documentUrl} target="_blank" className="mt-1 inline-block text-sm font-medium text-[#014171] underline">
                {c.documentName || "View Document"}
              </a>
            ) : (
              <p className="mt-1 text-sm text-slate-500">No document uploaded</p>
            )}
          </div>
        </dl>
      </Card>

      <div className="mb-3 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-lg font-bold text-[#014171]">Linked Printers</h2>
        <form method="get" className="flex flex-wrap gap-2">
          <SearchInput
            key={serial}
            name="serial"
            defaultValue={serial}
            placeholder="Search Serial Number"
            aria-label="Search linked printers by serial number"
            containerClassName="w-64 max-w-full"
          />
          <SecondaryButton type="submit">Search</SecondaryButton>
          {serial && <Link href={`/contracts/${c.id}`}><SecondaryButton type="button">Clear</SecondaryButton></Link>}
        </form>
      </div>
      <TableCard>
        {linkedPrinters.length === 0 ? (
          <EmptyState message={serial ? "No linked printers match that serial number." : "No printers linked to this contract."} />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Serial Number</th>
                <th className="px-4 py-3">Brand / Model</th>
                <th className="px-4 py-3">Location / Department</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {linkedPrinters.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3"><Link href={`/printers/${p.id}`} className="text-[#014171] hover:underline">{p.serialNumber}</Link></td>
                  <td className="px-4 py-3">{p.brand} / {p.model}</td>
                  <td className="px-4 py-3">{p.locationName || "—"} / {p.departmentName || "—"}</td>
                  <td className="px-4 py-3"><Badge color={statusBadgeColor(p.status)}>{p.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
