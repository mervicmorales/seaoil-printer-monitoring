import { NextResponse } from "next/server";
import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { monitoringAgents, notifications, systemSettings } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - getMonitoringStaleSeconds() * 1_000);

  try {
    const result = await db.transaction(async (tx) => {
      const newlyOffline = await tx
        .update(monitoringAgents)
        .set({ status: "offline", updatedAt: now })
        .where(
          and(
            eq(monitoringAgents.status, "online"),
            isNotNull(monitoringAgents.tokenHash),
            isNull(monitoringAgents.tokenRevokedAt),
            isNotNull(monitoringAgents.lastSeen),
            lt(monitoringAgents.lastSeen, cutoff),
          ),
        )
        .returning({ id: monitoringAgents.id, name: monitoringAgents.name });

      const [settings] = await tx
        .select({ enabled: systemSettings.systemNotificationEnabled })
        .from(systemSettings)
        .limit(1);

      if (newlyOffline.length > 0 && settings?.enabled !== false) {
        await tx.insert(notifications).values(
          newlyOffline.map((agent) => ({
            message: `Monitoring agent ${agent.name} is not reachable.`,
            type: "agent-offline",
          })),
        );
      }

      const agents = await tx
        .select({
          id: monitoringAgents.id,
          name: monitoringAgents.name,
          hostname: monitoringAgents.hostname,
          status: monitoringAgents.status,
          lastSeen: monitoringAgents.lastSeen,
        })
        .from(monitoringAgents)
        .where(
          and(
            isNotNull(monitoringAgents.tokenHash),
            isNull(monitoringAgents.tokenRevokedAt),
            isNotNull(monitoringAgents.lastSeen),
          ),
        );

      return {
        agents,
        newlyOfflineIds: newlyOffline.map((agent) => agent.id),
      };
    });

    return NextResponse.json({
      success: true,
      agents: result.agents.map((agent) => ({
        ...agent,
        reachable:
          agent.status === "online" &&
          agent.lastSeen !== null &&
          agent.lastSeen >= cutoff,
        lastSeen: agent.lastSeen?.toISOString() ?? null,
      })),
      newlyOfflineIds: result.newlyOfflineIds,
    });
  } catch (error) {
    console.error(
      "Monitoring agent status check failed:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to check monitoring agent status" },
      { status: 500 },
    );
  }
}
