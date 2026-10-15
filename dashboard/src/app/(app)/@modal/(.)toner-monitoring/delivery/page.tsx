import { PurchaseTonerPage } from "@/app/(app)/toner-monitoring/delivery/content";
import ModalShell from "@/components/ModalShell";

export default function DeliveryTonerModal() {
  return (
    <ModalShell
      title="Purchase Toner"
      closeHref="/toner-monitoring"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      variant="right-panel"
    >
      <PurchaseTonerPage embedded />
    </ModalShell>
  );
}
