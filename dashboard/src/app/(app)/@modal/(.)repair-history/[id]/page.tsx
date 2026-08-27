import ViewTicketPage from "@/app/(app)/repair-history/[id]/page";
import ModalShell from "@/components/ModalShell";

export default function RepairTicketViewModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ModalShell title="Repair Ticket Details" closeHref="/repair-history">
      <ViewTicketPage params={params} />
    </ModalShell>
  );
}
