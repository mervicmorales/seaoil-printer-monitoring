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
    >
      <ViewContractPage params={params} searchParams={searchParams} />
    </ModalShell>
  );
}
