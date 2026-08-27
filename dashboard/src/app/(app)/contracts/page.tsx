import Link from "next/link";
import { db } from "@/db";
import { contracts, vendors } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { PageHeader, TableCard, PrimaryButton, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import SuccessBanner from "@/components/SuccessBanner";
import DeleteButton from "@/components/DeleteButton";
import { deleteContractAction } from "./actions";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const sp = await searchParams;

  const rows = await db
    .select({
      id: contracts.id,
      contractNumber: contracts.contractNumber,
      vendorName: vendors.name,
      startDate: contracts.startDate,
      endDate: contracts.endDate,
      documentName: contracts.documentName,
    })
    .from(contracts)
    .leftJoin(vendors, eq(contracts.vendorId, vendors.id))
    .orderBy(asc(contracts.contractNumber));

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader
        title="Contract"
        subtitle="Centralized repository for printer service contracts."
        actions={access.contract ? <Link href="/contracts/new"><PrimaryButton>+ Upload Contract</PrimaryButton></Link> : undefined}
      />
      <SuccessBanner message={sp.success} />

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No contracts uploaded yet." />
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Contract Number</th>
                <th className="px-4 py-3">Vendor / Supplier</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End / Renewal</th>
                <th className="px-4 py-3">Document</th>
                <th className="w-px whitespace-nowrap px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium">{c.contractNumber}</td>
                  <td className="px-4 py-3">{c.vendorName || "—"}</td>
                  <td className="px-4 py-3">{formatDate(c.startDate)}</td>
                  <td className="px-4 py-3">{formatDate(c.endDate)}</td>
                  <td className="px-4 py-3">{c.documentName || "—"}</td>
                  <td className="w-px whitespace-nowrap px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/contracts/${c.id}`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">View</Link>
                      {access.contract && (
                        <DeleteButton action={deleteContractAction} id={c.id} confirmText="Delete this contract?" />
                      )}
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
