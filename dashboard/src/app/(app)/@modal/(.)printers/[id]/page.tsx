import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Pencil } from "lucide";
import PrinterViewPage from "@/app/(app)/printers/[id]/page";
import ModalShell from "@/components/ModalShell";
import DeleteButton from "@/components/DeleteButton";
import { db } from "@/db";
import { departments, locations, printers } from "@/db/schema";
import { deletePrinterAction } from "@/app/(app)/printers/actions";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";
import { IconGlyph } from "@/components/ui";

export default async function PrinterViewModal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; returnTo?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const returnTo = normalizePrinterReturnTo(resolvedSearchParams.returnTo);
  const session = await requireModuleFullAccess("printers");
  const access = await getModuleAccessMap(session.id, session.role);
  const { id } = await params;
  const printerId = Number(id);
  if (!Number.isInteger(printerId) || printerId < 1) notFound();
  const [printer] = await db.select({
    id: printers.id,
    serialNumber: printers.serialNumber,
    ipAddress: printers.ipAddress,
    location: locations.name,
    department: departments.name,
  }).from(printers)
    .leftJoin(locations, eq(printers.locationId, locations.id))
    .leftJoin(departments, eq(printers.departmentId, departments.id))
    .where(eq(printers.id, printerId))
    .limit(1);
  if (!printer) notFound();

  return (
    <ModalShell
      title={`${printer.location || "—"} / ${printer.department || "—"}`}
      subtitle={`${printer.serialNumber} / ${printer.ipAddress || "—"}`}
      closeHref={returnTo}
      headerActions={access.printers ? (
        <>
          <Link href={`/printers/${printer.id}/edit?returnTo=${encodeURIComponent(returnTo)}`} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
            <IconGlyph icon={Pencil} size={13} />
            Edit
          </Link>
          <DeleteButton
            action={deletePrinterAction}
            id={printer.id}
            confirmText="Delete this printer? This cannot be undone."
            label="Delete"
            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
          />
        </>
      ) : undefined}
    >
      <PrinterViewPage
        params={Promise.resolve({ id })}
        searchParams={Promise.resolve(resolvedSearchParams)}
        embedded
      />
    </ModalShell>
  );
}
