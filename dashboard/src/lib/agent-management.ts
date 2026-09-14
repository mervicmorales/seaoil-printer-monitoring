import type { AgentUpdateStatus } from "@/lib/agent-version";

export type AgentConnectivity = "online" | "offline";

export function agentManagementAuthorizationStatus(
  session: { role: string } | null,
  hasMonitoringPermission: boolean,
) {
  if (!session) return 401;
  if (
    (session.role !== "admin" && session.role !== "super_admin") ||
    !hasMonitoringPermission
  ) {
    return 403;
  }
  return 200;
}

export type AgentSummary = {
  id: number;
  name: string;
  location: string | null;
  connectivity: AgentConnectivity;
  installedVersion: string | null;
  latestVersion: string;
  updateStatus: AgentUpdateStatus;
  platform: string | null;
  platformLabel: string;
  architecture: string | null;
  hostname: string | null;
  nodeVersion: string | null;
  lastSeen: string | null;
  assignedPrinterCount: number;
};

export type AgentDetail = AgentSummary & {
  agentKey: string;
  buildIdentifier: string | null;
  lastSuccessfulUploadAt: string | null;
  agentUptimeSeconds: number | null;
  matchedPrinterCount: number | null;
  unmatchedPrinterCount: number | null;
  assignedLocations: string[];
};

// Keep API serialization explicit. Extra database properties (including token
// hashes) cannot leak through an object spread.
export function toPublicAgentSummary(agent: AgentSummary): AgentSummary {
  return {
    id: agent.id,
    name: agent.name,
    location: agent.location,
    connectivity: agent.connectivity,
    installedVersion: agent.installedVersion,
    latestVersion: agent.latestVersion,
    updateStatus: agent.updateStatus,
    platform: agent.platform,
    platformLabel: agent.platformLabel,
    architecture: agent.architecture,
    hostname: agent.hostname,
    nodeVersion: agent.nodeVersion,
    lastSeen: agent.lastSeen,
    assignedPrinterCount: agent.assignedPrinterCount,
  };
}

export function toPublicAgentDetail(agent: AgentDetail): AgentDetail {
  return {
    ...toPublicAgentSummary(agent),
    agentKey: agent.agentKey,
    buildIdentifier: agent.buildIdentifier,
    lastSuccessfulUploadAt: agent.lastSuccessfulUploadAt,
    agentUptimeSeconds: agent.agentUptimeSeconds,
    matchedPrinterCount: agent.matchedPrinterCount,
    unmatchedPrinterCount: agent.unmatchedPrinterCount,
    assignedLocations: [...agent.assignedLocations],
  };
}
