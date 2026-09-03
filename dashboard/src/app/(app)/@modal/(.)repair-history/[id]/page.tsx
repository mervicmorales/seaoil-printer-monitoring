import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Save } from "lucide";
import ViewTicketPage from "@/app/(app)/repair-history/[id]/page";
import { deleteTicketAction } from "@/app/(app)/repair-history/actions";
import TicketStatusSelect from "@/app/(app)/repair-history/TicketStatusSelect";
import DeleteButton from "@/components/DeleteButton";
import ModalShell from "@/components/ModalShell";
import { IconGlyph, PrimaryButton } from "@/components/ui";
import { db } from "@/db";
import { repairTickets } from "@/db/schema";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";

export default async function RepairTicketViewModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) notFound();

  const [ticket] = await db
    .select({ id: repairTickets.id, status: repairTickets.status })
    .from(repairTickets)
    .where(eq(repairTickets.id, ticketId))
    .limit(1);
  if (!ticket) notFound();

  return (
    <ModalShell
      title="Repair Ticket Details"
      closeHref="/repair-history"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      headerActions={access.repair ? (
        <>
          <TicketStatusSelect
            currentStatus={ticket.status}
            formId="repair-ticket-details-form"
            compact
          />
          {session.role === "admin" && (
            <DeleteButton
              action={deleteTicketAction}
              id={ticket.id}
              confirmText="Delete this repair ticket?"
              label="Delete Ticket"
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
            />
          )}
          <PrimaryButton
            type="submit"
            form="repair-ticket-details-form"
            className="px-3 py-1.5 text-xs"
          >
            <IconGlyph icon={Save} size={14} />
            {session.role === "support" ? "Save Status" : "Save Changes"}
          </PrimaryButton>
        </>
      ) : undefined}
    >
      <ViewTicketPage params={Promise.resolve({ id })} embedded />
    </ModalShell>
  );
}
