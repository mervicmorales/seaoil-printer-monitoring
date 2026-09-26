import { NewContractPage } from "@/app/(app)/contracts/new/content";
import ModalShell from "@/components/ModalShell";

export default function UploadContractModal() {
  return (
    <ModalShell
      title="Upload Contract"
      closeHref="/contracts"
      showTitle={false}
      pageHeaderInModal
      variant="right-panel"
      hideScrollbar
      contentClassName="flex-1 !overflow-hidden !p-4 sm:!p-5"
    >
      <NewContractPage embedded />
    </ModalShell>
  );
}
