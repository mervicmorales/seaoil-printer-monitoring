import EditTicketPage from "@/app/(app)/repair-history/[id]/edit/page";
import ModalShell from "@/components/ModalShell";

export default function RepairTicketEditModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ModalShell
      title="Edit repair ticket"
      closeHref="/repair-history"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
    >
      <EditTicketPage params={params} />
    </ModalShell>
  );
}
