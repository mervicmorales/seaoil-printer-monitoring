import NewContractPage from "@/app/(app)/contracts/new/page";
import ModalShell from "@/components/ModalShell";

export default function UploadContractModal() {
  return (
    <ModalShell
      title="Upload Contract"
      closeHref="/contracts"
      showTitle={false}
    >
      <NewContractPage />
    </ModalShell>
  );
}
