import EditContractPage from "@/app/(app)/contracts/[id]/edit/page";
import ModalShell from "@/components/ModalShell";

export default async function EditContractModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ModalShell
      title="Update Contract"
      closeHref={`/contracts/${id}`}
      showTitle={false}
      pageHeaderInModal
      variant="right-panel"
      hideScrollbar
      panelClassName="max-w-3xl"
      contentClassName="flex-1 !overflow-hidden !p-4 sm:!p-5"
    >
      <EditContractPage params={Promise.resolve({ id })} embedded />
    </ModalShell>
  );
}
