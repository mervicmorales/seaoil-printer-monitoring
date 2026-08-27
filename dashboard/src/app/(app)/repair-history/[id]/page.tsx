import { notFound } from "next/navigation";
import { db } from "@/db";
import { repairTickets, locations, departments, vendors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card, Badge, statusBadgeColor } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import DeleteButton from "@/components/DeleteButton";
import { deleteTicketAction, updateTicketDetailsAction } from "../actions";
import TicketStatusSelect from "../TicketStatusSelect";
import TicketDetailsForm from "./TicketDetailsForm";

export default async function ViewTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
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
        actions={
          <>
            {access.repair && (
              <>
                <TicketStatusSelect
                  currentStatus={t.status}
                  formId="repair-ticket-details-form"
                />
                <div className="pt-5">
                  <DeleteButton
                    action={deleteTicketAction}
                    id={t.id}
                    confirmText="Delete this repair ticket?"
                    label="Delete Ticket"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  />
                </div>
              </>
            )}
          </>
        }
      />
      <Card className="p-6">
        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
          />
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-100 pt-6 lg:grid-cols-2">
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
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}
