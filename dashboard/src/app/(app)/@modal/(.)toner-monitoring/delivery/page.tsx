import DeliveryTonerPage from "@/app/(app)/toner-monitoring/delivery/page";
import ModalShell from "@/components/ModalShell";

export default function DeliveryTonerModal() {
  return (
    <ModalShell
      title="Add Toner"
      closeHref="/toner-monitoring"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
    >
      <DeliveryTonerPage embedded />
    </ModalShell>
  );
}
