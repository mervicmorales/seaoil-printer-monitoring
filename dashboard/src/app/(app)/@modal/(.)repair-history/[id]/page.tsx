import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { Save } from "lucide";
import { ViewTicketPage } from "@/app/(app)/repair-history/[id]/content";
import { deleteTicketAction } from "@/app/(app)/repair-history/actions";
import TicketStatusSelect from "@/app/(app)/repair-history/TicketStatusSelect";
import DeleteButton from "@/components/DeleteButton";
import ModalShell from "@/components/ModalShell";
import { IconGlyph, PrimaryButton } from "@/components/ui";
import { db } from "@/db";
import { repairTickets } from "@/db/schema";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";
import { hasAdminPrivileges } from "@/lib/roles";

export default async function RepairTicketViewModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireModuleFullAccess("repair");
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
      variant="right-panel"
      panelClassName="max-w-[48rem] !bg-white sm:m-3 sm:!h-[calc(100dvh-1.5rem)] sm:rounded-3xl sm:border sm:border-slate-200"
      contentClassName="flex-1 !overflow-x-hidden !overflow-y-auto !bg-white !p-4 sm:!p-5"
      closeButtonClassName="!rounded-full !border-transparent !bg-slate-100 !shadow-none hover:!bg-slate-200"
      headerActions={access.repair ? (
        <>
          <TicketStatusSelect
            currentStatus={ticket.status}
            formId="repair-ticket-details-form"
            compact
          />
          {hasAdminPrivileges(session.role) && (
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
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
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
