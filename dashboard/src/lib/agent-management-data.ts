import "server-only";

import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  monitoringAgentLocations,
  monitoringAgents,
  printerMonitoringAssignments,
} from "@/db/schema";
import {
  getAgentUpdateStatus,
  isAgentOnline,
  parseSemver,
  platformLabel,
} from "@/lib/agent-version";
import {
  toPublicAgentDetail,
  toPublicAgentSummary,
  type AgentDetail,
  type AgentSummary,
} from "@/lib/agent-management";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";

const DEFAULT_LATEST_AGENT_VERSION = "4.0.0";

export function getLatestSupportedAgentVersion() {
  const configured = process.env.LATEST_AGENT_VERSION?.trim();
  return parseSemver(configured) ? configured! : DEFAULT_LATEST_AGENT_VERSION;
}

async function getAgentRows() {
  return db
    .select({
      id: monitoringAgents.id,
      agentKey: monitoringAgents.agentKey,
      name: monitoringAgents.name,
      location: locations.name,
      hostname: monitoringAgents.hostname,
      version: monitoringAgents.version,
      platform: monitoringAgents.platform,
      architecture: monitoringAgents.architecture,
      nodeVersion: monitoringAgents.nodeVersion,
      agentUptimeSeconds: monitoringAgents.agentUptimeSeconds,
      buildIdentifier: monitoringAgents.buildIdentifier,
      storedStatus: monitoringAgents.status,
      tokenRevokedAt: monitoringAgents.tokenRevokedAt,
      lastSeen: monitoringAgents.lastSeen,
      lastSuccessfulUploadAt: monitoringAgents.lastSuccessfulUploadAt,
      lastMatchedPrinterCount: monitoringAgents.lastMatchedPrinterCount,
      lastUnmatchedPrinterCount: monitoringAgents.lastUnmatchedPrinterCount,
      assignedPrinterCount: sql<number>`(
        select count(*)::int
        from ${printerMonitoringAssignments}
        where ${printerMonitoringAssignments.agentId} = ${monitoringAgents.id}
      )`.mapWith(Number),
    })
    .from(monitoringAgents)
    .leftJoin(locations, eq(monitoringAgents.locationId, locations.id))
    .orderBy(asc(monitoringAgents.name), asc(monitoringAgents.id));
}

export async function getMonitoringAgentSummaries(): Promise<AgentSummary[]> {
  const [rows, staleSeconds] = await Promise.all([
    getAgentRows(),
    getMonitoringStaleSeconds(),
  ]);
  const now = new Date();
  const latestVersion = getLatestSupportedAgentVersion();

  return rows.map((row) =>
    toPublicAgentSummary({
      id: row.id,
      name: row.name,
      location: row.location,
      connectivity: isAgentOnline({
        storedStatus: row.storedStatus,
        lastSeen: row.lastSeen,
        tokenRevokedAt: row.tokenRevokedAt,
        staleSeconds,
        now,
      })
        ? "online"
        : "offline",
      installedVersion: row.version,
      latestVersion,
      updateStatus: getAgentUpdateStatus(row.version, latestVersion),
      platform: row.platform,
      platformLabel: platformLabel(row.platform),
      architecture: row.architecture,
      hostname: row.hostname,
      nodeVersion: row.nodeVersion,
      lastSeen: row.lastSeen?.toISOString() ?? null,
      assignedPrinterCount: row.assignedPrinterCount,
    }),
  );
}

export async function getMonitoringAgentDetail(id: number): Promise<AgentDetail | null> {
  const [rows, staleSeconds, coveredLocations] = await Promise.all([
    getAgentRows(),
    getMonitoringStaleSeconds(),
    db
      .select({ name: locations.name })
      .from(monitoringAgentLocations)
      .innerJoin(locations, eq(monitoringAgentLocations.locationId, locations.id))
      .where(eq(monitoringAgentLocations.agentId, id))
      .orderBy(asc(locations.name)),
  ]);
  const row = rows.find((candidate) => candidate.id === id);
  if (!row) return null;

  const latestVersion = getLatestSupportedAgentVersion();
  const assignedLocations = coveredLocations.map((item) => item.name);
  if (row.location && !assignedLocations.includes(row.location)) {
    assignedLocations.unshift(row.location);
  }

  return toPublicAgentDetail({
    id: row.id,
    agentKey: row.agentKey,
    name: row.name,
    location: row.location,
    connectivity: isAgentOnline({
      storedStatus: row.storedStatus,
      lastSeen: row.lastSeen,
      tokenRevokedAt: row.tokenRevokedAt,
      staleSeconds,
    })
      ? "online"
      : "offline",
    installedVersion: row.version,
    latestVersion,
    updateStatus: getAgentUpdateStatus(row.version, latestVersion),
    platform: row.platform,
    platformLabel: platformLabel(row.platform),
    architecture: row.architecture,
    hostname: row.hostname,
    nodeVersion: row.nodeVersion,
    buildIdentifier: row.buildIdentifier,
    lastSeen: row.lastSeen?.toISOString() ?? null,
    lastSuccessfulUploadAt: row.lastSuccessfulUploadAt?.toISOString() ?? null,
    agentUptimeSeconds: row.agentUptimeSeconds,
    assignedPrinterCount: row.assignedPrinterCount,
    matchedPrinterCount: row.lastMatchedPrinterCount,
    unmatchedPrinterCount: row.lastUnmatchedPrinterCount,
    assignedLocations,
  });
}
