import { EditTransactionPage } from "@/app/(app)/toner-monitoring/[id]/edit/content";
import ModalShell from "@/components/ModalShell";

export default function EditTonerTransactionModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ModalShell
      title="Edit Toner Transaction"
      closeHref="/toner-monitoring"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      variant="right-panel"
    >
      <EditTransactionPage params={params} embedded />
    </ModalShell>
  );
}
