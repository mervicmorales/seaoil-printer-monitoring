import { DeliveryTonerPage } from "@/app/(app)/toner-monitoring/delivery/content";
import ModalShell from "@/components/ModalShell";

export default function DeliveryTonerModal() {
  return (
    <ModalShell
      title="Add Toner"
      closeHref="/toner-monitoring"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      variant="right-panel"
    >
      <DeliveryTonerPage embedded />
    </ModalShell>
  );
}
