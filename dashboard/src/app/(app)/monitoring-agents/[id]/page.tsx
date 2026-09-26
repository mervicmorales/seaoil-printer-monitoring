import { MonitoringAgentDetailPage } from "./content";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return <MonitoringAgentDetailPage params={params} />;
}
