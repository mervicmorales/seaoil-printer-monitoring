import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import PrinterViewPage from "@/app/(app)/printers/[id]/page";
import ModalShell from "@/components/ModalShell";
import DeleteButton from "@/components/DeleteButton";
import { db } from "@/db";
import { departments, locations, printers } from "@/db/schema";
import { deletePrinterAction } from "@/app/(app)/printers/actions";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";

export default async function PrinterViewModal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; returnTo?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const returnTo = normalizePrinterReturnTo(resolvedSearchParams.returnTo);
  const session = await requireSession();
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
          <Link href={`/printers/${printer.id}/edit?returnTo=${encodeURIComponent(returnTo)}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Edit</Link>
          <DeleteButton
            action={deletePrinterAction}
            id={printer.id}
            confirmText="Delete this printer? This cannot be undone."
            label="Delete"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
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
