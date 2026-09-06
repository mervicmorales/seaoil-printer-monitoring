import { notFound } from "next/navigation";
import { db } from "@/db";
import { repairTickets, locations, departments, vendors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ClipboardList } from "lucide";
import { PageHeader, Card, Badge, statusBadgeColor, IconGlyph } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";
import DeleteButton from "@/components/DeleteButton";
import { deleteTicketAction, updateTicketDetailsAction } from "../actions";
import TicketStatusSelect from "../TicketStatusSelect";
import TicketDetailsForm from "./TicketDetailsForm";
import { hasAdminPrivileges } from "@/lib/roles";

export default async function ViewTicketPage({
  params,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  embedded?: boolean;
}) {
  const session = await requireModuleFullAccess("repair");
  const access = await getModuleAccessMap(session.id, session.role);
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) notFound();

  const rows = await db
    .select({
      ticket: repairTickets,
      locationName: locations.name,
      departmentName: departments.name,
      vendorName: vendors.name,
    })
    .from(repairTickets)
    .leftJoin(locations, eq(repairTickets.locationId, locations.id))
    .leftJoin(departments, eq(repairTickets.departmentId, departments.id))
    .leftJoin(vendors, eq(repairTickets.vendorId, vendors.id))
    .where(eq(repairTickets.id, ticketId))
    .limit(1);

  const record = rows[0];
  if (!record) notFound();
  const t = record.ticket;

  return (
    <div>
      <PageHeader
        title={`Ticket ${t.ticketNumber}`}
        subtitle={`Serial Number: ${t.serialNumber}`}
        actions={!embedded ? (
          <>
            {access.repair && (
              <>
                <TicketStatusSelect
                  currentStatus={t.status}
                  formId="repair-ticket-details-form"
                />
                {hasAdminPrivileges(session.role) && <div className="pt-5">
                  <DeleteButton
                    action={deleteTicketAction}
                    id={t.id}
                    confirmText="Delete this repair ticket?"
                    label="Delete Ticket"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
                  />
                </div>}
              </>
            )}
          </>
        ) : undefined}
      />
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={ClipboardList} size={17} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#014171]">Ticket information</h2>
            <p className="mt-0.5 text-xs text-slate-500">Printer, assignment, and service dates for this repair request.</p>
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-3 bg-slate-50/60 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-3">
          <Field label="Requested Date" value={formatDate(t.requestedDate)} />
          <Field label="Department" value={record.departmentName || "—"} />
          <Field label="Location" value={record.locationName || "—"} />
          <Field label="Vendor" value={record.vendorName || "—"} />
          <Field label="Date Closed" value={formatDate(t.dateClosed)} />
          {!access.repair && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ticket Status</p>
              <p className="mt-1"><Badge color={statusBadgeColor(t.status)}>{t.status}</Badge></p>
            </div>
          )}
        </dl>
        {access.repair ? (
          <TicketDetailsForm
            action={updateTicketDetailsAction}
            ticketId={t.id}
            status={t.status}
            problem={t.problem}
            remarks={t.notes}
            resolution={t.resolution}
            resolutionAttachmentUrl={t.resolutionAttachmentUrl}
            resolutionAttachmentName={t.resolutionAttachmentName}
            statusOnly={session.role === "support"}
            showActions={!embedded}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 border-t border-slate-200 bg-white p-5 sm:p-6 lg:grid-cols-2">
            <Field label="Concern" value={t.problem} />
            <div>
              <Field label="Resolution" value={t.resolution || "—"} />
              {t.resolutionAttachmentUrl && (
                <a
                  href={t.resolutionAttachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-sm font-medium text-[#014171] underline"
                >
                  {t.resolutionAttachmentName || "View attachment"}
                </a>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</dt>
      <dd className="mt-1.5 break-words text-sm font-semibold text-slate-800">{value}</dd>
    </div>
  );
}
