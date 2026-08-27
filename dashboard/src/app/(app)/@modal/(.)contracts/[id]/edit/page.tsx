import EditContractPage from "@/app/(app)/contracts/[id]/edit/page";
import ModalShell from "@/components/ModalShell";

export default function EditContractModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ModalShell
      title="Update Contract"
      closeHref="/contracts"
      showTitle={false}
    >
      <EditContractPage params={params} />
    </ModalShell>
  );
}
