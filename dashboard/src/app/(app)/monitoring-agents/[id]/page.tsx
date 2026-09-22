import { notFound } from "next/navigation";
import AgentDetailView from "./AgentDetailView";
import { getMonitoringAgentDetail } from "@/lib/agent-management-data";
import { requireAdmin } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export default async function MonitoringAgentDetailPage({
  params,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  embedded?: boolean;
}) {
  await requireAdmin("monitoring_alerts");
  const rawId = (await params).id;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const agent = await getMonitoringAgentDetail(id);
  if (!agent) notFound();
  return <AgentDetailView initialAgent={agent} embedded={embedded} />;
}
