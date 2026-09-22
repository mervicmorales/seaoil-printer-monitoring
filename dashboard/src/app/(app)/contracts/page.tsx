import Link from "next/link";
import { db } from "@/db";
import { contracts, vendors } from "@/db/schema";
import { asc, eq, ilike, or } from "drizzle-orm";
import { Eye, Plus, SearchX } from "lucide";
import { PageHeader, TableCard, IconGlyph } from "@/components/ui";
import { formatDate } from "@/lib/format";
import SuccessBanner from "@/components/SuccessBanner";
import DeleteButton from "@/components/DeleteButton";
import { deleteContractAction } from "./actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { hasAdminPrivileges } from "@/lib/roles";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import Search from "@/components/Search";
import RecordTableToolbar from "@/components/RecordTableToolbar";

export const dynamic = "force-dynamic";

export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ success?: string; q?: string }> }) {
  const session = await requireModuleFullAccess("contract");
  const sp = await searchParams;
  const query = sp.q?.trim() ?? "";

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
    .where(query ? or(
      ilike(contracts.contractNumber, `%${query}%`),
      ilike(vendors.name, `%${query}%`),
      ilike(contracts.documentName, `%${query}%`),
    ) : undefined)
    .orderBy(asc(contracts.contractNumber));

  return (
    <div className="flex h-[calc(100dvh-103px)] min-h-0 flex-col sm:h-[calc(100dvh-111px)]">
      <PageHeader
        parentTitle="Contracts"
        title="Contract Records"
      />
      <SuccessBanner message={sp.success} showInline={false} />

      <TableCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <RecordTableToolbar count={rows.length} label="contract">
          <AutoSubmitFilterForm method="get">
            <Search
              name="q"
              defaultValue={query}
              placeholder="Search contracts"
              ariaLabel="Search contracts"
            />
          </AutoSubmitFilterForm>
          {hasAdminPrivileges(session.role) && (
            <Link href="/contracts/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#00365f]">
              <IconGlyph icon={Plus} size={15} />
              Upload Contract
            </Link>
          )}
        </RecordTableToolbar>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[22%]" />
              <col className="w-[12%]" />
              <col className="w-[14%]" />
              <col className="w-[20%]" />
              <col className="w-[15%]" />
            </colgroup>
            <thead className="bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3">Contract Number</th>
                <th className="px-4 py-3">Vendor / Supplier</th>
                <th className="px-4 py-3">Start</th>
                <th className="px-4 py-3">End / Renewal</th>
                <th className="px-4 py-3">Document</th>
                <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-500">
                    <span className="inline-flex flex-col items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><IconGlyph icon={SearchX} size={20} /></span>
                      <span>No contracts found</span>
                    </span>
                  </td>
                </tr>
              ) : rows.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-medium"><p className="truncate" title={c.contractNumber}>{c.contractNumber}</p></td>
                  <td className="px-4 py-3"><p className="truncate" title={c.vendorName || "—"}>{c.vendorName || "—"}</p></td>
                  <td className="px-4 py-3">{formatDate(c.startDate)}</td>
                  <td className="px-4 py-3">{formatDate(c.endDate)}</td>
                  <td className="px-4 py-3"><p className="truncate" title={c.documentName || "—"}>{c.documentName || "—"}</p></td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Link href={`/contracts/${c.id}`} aria-label={`View contract ${c.contractNumber}`} className="inline-flex size-8 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100">
                        <IconGlyph icon={Eye} size={16} />
                      </Link>
                      {hasAdminPrivileges(session.role) && (
                        <DeleteButton action={deleteContractAction} id={c.id} confirmText="Delete this contract?" />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableCard>
    </div>
  );
}
