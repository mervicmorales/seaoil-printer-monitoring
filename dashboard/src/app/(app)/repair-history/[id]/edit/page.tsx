import { notFound } from "next/navigation";
import { db } from "@/db";
import { repairTickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { getDepartments, getLocations, getVendors } from "@/lib/lookups";
import EditTicketForm from "./EditTicketForm";
import { updateTicketAction } from "../../actions";
import { requireAdmin } from "@/lib/server-utils";
import TicketStatusSelect from "../../TicketStatusSelect";

export default async function EditTicketPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const ticketId = Number(id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) notFound();
  const rows = await db.select().from(repairTickets).where(eq(repairTickets.id, ticketId)).limit(1);
  const ticket = rows[0];
  if (!ticket) notFound();

  const [locations, departments, vendors] = await Promise.all([getLocations(), getDepartments(), getVendors()]);

  return (
    <div>
      <PageHeader
        title={`Edit Ticket ${ticket.ticketNumber}`}
        subtitle="Update ticket details or close the ticket."
        actions={
          <TicketStatusSelect
            currentStatus={ticket.status}
            formId="repair-ticket-edit-form"
          />
        }
      />
      <Card className="p-6">
        <EditTicketForm
          action={updateTicketAction}
          ticket={ticket}
          locations={locations}
          departments={departments}
          vendors={vendors}
        />
      </Card>
    </div>
  );
}
