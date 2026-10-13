import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { locations } from "@/db/schema";
import AgentManagementTable from "./AgentManagementTable";
import { getMonitoringAgentSummaries } from "@/lib/agent-management-data";
import { requireAdmin } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export default async function MonitoringAgentsPage() {
  await requireAdmin("monitoring_alerts");
  const [agents, offices] = await Promise.all([
    getMonitoringAgentSummaries(),
    db
      .select({ id: locations.id, name: locations.name })
      .from(locations)
      .where(eq(locations.status, "active"))
      .orderBy(asc(locations.name)),
  ]);

  return (
    <AgentManagementTable
      initialAgents={agents}
      initialGeneratedAt={new Date().toISOString()}
      offices={offices}
    />
  );
}
