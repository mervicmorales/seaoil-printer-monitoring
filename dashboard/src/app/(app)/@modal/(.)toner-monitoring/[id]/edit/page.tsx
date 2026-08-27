import EditTransactionPage from "@/app/(app)/toner-monitoring/[id]/edit/page";
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
    >
      <EditTransactionPage params={params} />
    </ModalShell>
  );
}
