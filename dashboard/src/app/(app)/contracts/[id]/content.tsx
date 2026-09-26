import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { contracts, vendors, printers, locations, departments } from "@/db/schema";
import { and, eq, ilike } from "drizzle-orm";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ExternalLink,
  FileText,
  Pencil,
  Printer,
  type IconNode,
} from "lucide";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  EmptyState,
  Badge,
  IconGlyph,
  statusBadgeColor,
} from "@/components/ui";
import { formatDate } from "@/lib/format";
import { requireModuleFullAccess } from "@/lib/server-utils";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import Search from "@/components/Search";
import { hasAdminPrivileges } from "@/lib/roles";
import { printerDetailHref } from "@/lib/printer-navigation";

export async function ViewContractPage({
  params,
  searchParams,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ serial?: string }>;
  embedded?: boolean;
}) {
  const session = await requireModuleFullAccess("contract");
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
  const contractReturnTo = `/contracts/${c.id}${serial ? `?serial=${encodeURIComponent(serial)}` : ""}`;

  return (
    <div className={embedded ? "flex h-full min-h-0 flex-col" : ""}>
      <PageHeader
        title={`Contract ${c.contractNumber}`}
        subtitle={record.vendorName || "Contract details and linked printers"}
        actions={
          <>
            {hasAdminPrivileges(session.role) && (
              <Link href={`/contracts/${c.id}/edit`}>
                <PrimaryButton className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none">
                  <IconGlyph icon={Pencil} size={14} />
                  Update Contract
                </PrimaryButton>
              </Link>
            )}
            {!embedded && (
              <Link href="/contracts">
                <SecondaryButton>
                  <IconGlyph icon={ArrowLeft} size={15} />
                  Back to List
                </SecondaryButton>
              </Link>
            )}
          </>
        }
      />

      <Card className={`shrink-0 overflow-hidden ${embedded ? "mb-3" : "mb-5"}`}>
        <div className={`flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 ${embedded ? "px-4 py-3" : "px-5 py-4"}`}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#014171]">
            <IconGlyph icon={FileText} size={17} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Contract overview</h2>
            <p className="mt-0.5 text-xs text-slate-500">Supplier, coverage dates, and supporting document</p>
          </div>
        </div>

        <dl className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <OverviewField
            icon={Building2}
            label="Vendor / Supplier"
            value={record.vendorName || "—"}
            detail={record.vendorEmail || undefined}
          />
          <OverviewField icon={CalendarDays} label="Contract Start" value={formatDate(c.startDate)} />
          <OverviewField icon={CalendarDays} label="End / Renewal" value={formatDate(c.endDate)} />
        </dl>

        <div className="grid grid-cols-1 border-t border-slate-200 lg:grid-cols-[1fr_1.15fr] lg:divide-x lg:divide-slate-200">
          <div className={embedded ? "px-4 py-3" : "px-5 py-4"}>
            <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">Notes</p>
            <p className={`mt-2 whitespace-pre-wrap text-sm text-slate-700 ${embedded ? "line-clamp-2 leading-5" : "leading-6"}`}>{c.notes || "No notes added."}</p>
          </div>
          <div className={`border-t border-slate-200 lg:border-t-0 ${embedded ? "px-4 py-3" : "px-5 py-4"}`}>
            <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">Contract Document</p>
            {c.documentUrl ? (
              <a
                href={`/api/contracts/${c.id}/document`}
                target="_blank"
                rel="noreferrer"
                className={`mt-2 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/70 px-3.5 text-sm font-semibold text-[#014171] transition hover:border-sky-300 hover:bg-sky-50 ${embedded ? "py-2" : "py-3"}`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm">
                  <IconGlyph icon={FileText} size={15} />
                </span>
                <span className="min-w-0 flex-1 truncate">{c.documentName || "View Document"}</span>
                <IconGlyph icon={ExternalLink} size={15} />
              </a>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No document uploaded.</p>
            )}
          </div>
        </div>
      </Card>

      <div className="mb-3 flex shrink-0 flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#014171]">
            <IconGlyph icon={Printer} size={17} />
          </span>
          <div>
            <h2 className="text-base font-bold text-[#014171]">Linked Printers</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {linkedPrinters.length} {linkedPrinters.length === 1 ? "printer" : "printers"}{serial ? " found" : " assigned"}
            </p>
          </div>
        </div>
        <AutoSubmitFilterForm method="get" className="flex w-full justify-end sm:w-auto">
          <Search
            name="serial"
            defaultValue={serial}
            placeholder="Search Serial Number"
            ariaLabel="Search linked printers by serial number"
          />
        </AutoSubmitFilterForm>
      </div>
      <Card className={embedded ? "flex min-h-0 flex-1 flex-col overflow-hidden" : "overflow-hidden"}>
        {linkedPrinters.length === 0 ? (
          <div className={embedded ? "flex min-h-0 flex-1 items-center justify-center" : ""}>
            <EmptyState message={serial ? "No linked printers match that serial number." : "No printers linked to this contract."} />
          </div>
        ) : (
          <div className={embedded ? "min-h-0 flex-1 overflow-x-hidden overflow-y-auto" : "max-h-72 overflow-auto"}>
            <table className={`w-full text-left text-sm ${embedded ? "table-fixed" : "min-w-[640px]"}`}>
              {embedded && <colgroup><col className="w-[22%]" /><col className="w-[27%]" /><col className="w-[37%]" /><col className="w-[14%]" /></colgroup>}
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Serial Number</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Location / Department</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {linkedPrinters.map((p) => (
                  <tr key={p.id} className="transition hover:bg-slate-50/70">
                    <td className="px-4 py-3.5 font-semibold"><Link href={printerDetailHref(p.id, contractReturnTo)} className="block truncate text-[#014171] hover:underline" title={p.serialNumber}>{p.serialNumber}</Link></td>
                    <td className="px-4 py-3.5 text-slate-700"><p className="truncate" title={p.model || "—"}>{p.model || "—"}</p></td>
                    <td className="px-4 py-3.5 text-slate-600"><p className="line-clamp-2" title={`${p.locationName || "—"} / ${p.departmentName || "—"}`}>{p.locationName || "—"} / {p.departmentName || "—"}</p></td>
                    <td className="px-4 py-3.5"><Badge color={statusBadgeColor(p.status)}>{p.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function OverviewField({
  icon,
  label,
  value,
  detail,
}: {
  icon: IconNode;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 px-5 py-4">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <IconGlyph icon={icon} size={15} />
      </span>
      <div className="min-w-0">
        <dt className="text-[10px] font-bold uppercase tracking-[0.11em] text-slate-400">{label}</dt>
        <dd className="mt-1 truncate text-sm font-semibold text-slate-800">{value}</dd>
        {detail && <p className="mt-0.5 truncate text-xs text-slate-500">{detail}</p>}
      </div>
    </div>
  );
}
