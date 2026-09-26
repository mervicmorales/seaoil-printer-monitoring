import { MonitoringAgentDetailPage } from "@/app/(app)/monitoring-agents/[id]/content";
import ModalShell from "@/components/ModalShell";

export default function MonitoringAgentDetailModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ModalShell
      title="Monitoring Agent Details"
      closeHref="/monitoring-agents"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      variant="right-panel"
      contentClassName="flex-1 !overflow-hidden !p-4 sm:!p-5"
    >
      <MonitoringAgentDetailPage params={params} embedded />
    </ModalShell>
  );
}
