import RequestTonerPage from "@/app/(app)/toner-monitoring/request/page";
import ModalShell from "@/components/ModalShell";

export default function RequestTonerModal() {
  return (
    <ModalShell
      title="Request Toner"
      closeHref="/toner-monitoring"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
    >
      <RequestTonerPage embedded />
    </ModalShell>
  );
}
