import AgentManagementTable from "./AgentManagementTable";
import { getMonitoringAgentSummaries } from "@/lib/agent-management-data";
import { requireAdmin } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export default async function MonitoringAgentsPage() {
  await requireAdmin("monitoring_alerts");
  const agents = await getMonitoringAgentSummaries();

  return (
    <AgentManagementTable
      initialAgents={agents}
      initialGeneratedAt={new Date().toISOString()}
    />
  );
}
