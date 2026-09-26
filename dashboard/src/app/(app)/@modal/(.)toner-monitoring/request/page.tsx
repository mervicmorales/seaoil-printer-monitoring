import { RequestTonerPage } from "@/app/(app)/toner-monitoring/request/content";
import ModalShell from "@/components/ModalShell";

export default function RequestTonerModal() {
  return (
    <ModalShell
      title="Request Toner"
      closeHref="/toner-monitoring"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      variant="right-panel"
    >
      <RequestTonerPage embedded />
    </ModalShell>
  );
}
