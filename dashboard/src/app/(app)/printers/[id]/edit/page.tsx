import { notFound } from "next/navigation";
import { db } from "@/db";
import { printerMonitoringAssignments, printers, printerTonerTypes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { RefreshCw } from "lucide";
import {
  getContracts,
  getDepartments,
  getLocations,
  getProvisionedMonitoringAgents,
  getTonerTypes,
  getVendors,
} from "@/lib/lookups";
import PrinterForm from "../../PrinterForm";
import { addReplacementAction, updatePrinterAction } from "../../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";
import ReplacementForm from "./ReplacementForm";
import PrinterStatusSelect from "./PrinterStatusSelect";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";
import { hasAdminPrivileges } from "@/lib/roles";

export default async function EditPrinterPage({
  params,
  searchParams,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
  embedded?: boolean;
}) {
  const session = await requireModuleFullAccess("printer_records");
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const returnTo = normalizePrinterReturnTo(resolvedSearchParams.returnTo);
  const printerId = Number(id);
  if (!Number.isInteger(printerId) || printerId <= 0) notFound();

  const rows = await db.select().from(printers).where(eq(printers.id, printerId)).limit(1);
  const printer = rows[0];
  if (!printer) notFound();

  const tonerLinks = await db
    .select({ tonerTypeId: printerTonerTypes.tonerTypeId })
    .from(printerTonerTypes)
    .where(eq(printerTonerTypes.printerId, printerId));

  const [monitoringAssignment] = await db
    .select({ agentId: printerMonitoringAssignments.agentId })
    .from(printerMonitoringAssignments)
    .where(eq(printerMonitoringAssignments.printerId, printerId))
    .limit(1);

  const [tonerTypes, locations, departments, vendors, contracts, monitoringAgents] = await Promise.all([
    getTonerTypes(),
    getLocations(),
    getDepartments(),
    getVendors(),
    getContracts(),
    getProvisionedMonitoringAgents(),
  ]);

  return (
    <div>
      <PageHeader
        title="Edit Printer"
        subtitle={`Serial Number: ${printer.serialNumber}`}
        actions={embedded ? (
          <div className="flex flex-wrap items-end gap-2">
            {hasAdminPrivileges(session.role) && (
              <PrinterStatusSelect
                currentStatus={printer.status}
                formId="printer-edit-form"
                printerId={printer.id}
                compact
              />
            )}
            <PrimaryButton
              type="submit"
              form="printer-edit-form"
              className="px-3 py-1.5 text-xs"
            >
              Save Changes
            </PrimaryButton>
          </div>
        ) : hasAdminPrivileges(session.role) ? (
          <PrinterStatusSelect
            currentStatus={printer.status}
            formId="printer-edit-form"
            printerId={printer.id}
          />
        ) : undefined}
      />
      <Card className="p-5 sm:p-6">
        <PrinterForm
            mode="edit"
            action={updatePrinterAction}
            printer={{
              ...printer,
              monitoringEnabled: Boolean(monitoringAssignment),
              monitoringAgentId: monitoringAssignment?.agentId ?? null,
            }}
            tonerTypes={tonerTypes}
            locations={locations}
            departments={departments}
            vendors={vendors}
            contracts={contracts}
            monitoringAgents={monitoringAgents}
            selectedTonerTypeIds={tonerLinks.map((t) => t.tonerTypeId)}
            returnTo={returnTo}
            limitedSupport={session.role === "support"}
            showActions={!embedded}
            replacementContent={
              <div className="space-y-5">
                <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                    <IconGlyph icon={RefreshCw} size={17} />
                  </span>
                  <div>
                  <h3 className="text-sm font-bold text-[#014171]">Record Replacement</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Replacing this unit preserves the old serial number in Replacement History.
                  </p>
                  </div>
                </div>
                {hasAdminPrivileges(session.role) ? <ReplacementForm
                  action={addReplacementAction}
                  printerId={printer.id}
                  oldSerialNumber={printer.serialNumber}
                  model={printer.model || ""}
                  today={todayISO()}
                  returnTo={returnTo}
                /> : <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Replacement history is view-only for Support users. Open the printer details page to review past replacements.</p>}
              </div>
            }
          />
      </Card>
    </div>
  );
}
