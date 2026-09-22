import ViewContractPage from "@/app/(app)/contracts/[id]/page";
import ModalShell from "@/components/ModalShell";

export default function ViewContractModal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ serial?: string }>;
}) {
  return (
    <ModalShell
      title="Contract Details"
      closeHref="/contracts"
      showTitle={false}
      pageHeaderInModal
      variant="right-panel"
      hideScrollbar
      panelClassName="max-w-5xl"
      contentClassName="flex-1 !overflow-hidden !p-4 sm:!p-5"
    >
      <ViewContractPage params={params} searchParams={searchParams} embedded />
    </ModalShell>
  );
}
