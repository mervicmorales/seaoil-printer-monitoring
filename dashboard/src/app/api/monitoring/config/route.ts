import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  locations,
  monitoringAgents,
  notifications,
  printerMonitoringAssignments,
  printers,
  systemSettings,
} from "@/db/schema";
import {
  authenticateMonitoringAgent,
  monitoringAgentKeySchema,
} from "@/lib/monitoring";
import { sendAgentTransitionEmail } from "@/lib/agent-alerts";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parsedAgentKey = monitoringAgentKeySchema.safeParse(
    request.headers.get("x-seaoil-agent-key"),
  );
  if (!parsedAgentKey.success) {
    return unauthorized();
  }

  let authentication;
  try {
    authentication = await authenticateMonitoringAgent(
      request.headers.get("authorization"),
      parsedAgentKey.data,
    );
  } catch (error) {
    console.error(
      "Monitoring configuration authentication error:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to authenticate monitoring agent" },
      { status: 500 },
    );
  }

  if (authentication.status === "unauthorized") {
    return unauthorized();
  }

  try {
    const now = new Date();
    const principal = authentication.principal;
    const [before] = await db.select({ lastSeen: monitoringAgents.lastSeen }).from(monitoringAgents).where(eq(monitoringAgents.id, principal.id)).limit(1);
    const agent = await db.transaction(async (tx) => {
      const [recoveredAgent] = await tx
        .update(monitoringAgents)
        .set({ status: "online", lastSeen: now, updatedAt: now })
        .where(
          and(
            eq(monitoringAgents.id, principal.id),
            eq(monitoringAgents.status, "offline"),
            isNull(monitoringAgents.tokenRevokedAt),
          ),
        )
        .returning({ id: monitoringAgents.id, name: monitoringAgents.name });

      if (recoveredAgent) {
        const [settings] = await tx
          .select({ enabled: systemSettings.systemNotificationEnabled })
          .from(systemSettings)
          .limit(1);
        if (settings?.enabled !== false) {
          await tx.insert(notifications).values({
            message: `Monitoring agent ${recoveredAgent.name} is online again.`,
            type: "agent-online",
          });
        }
        return { id: recoveredAgent.id, recovered: true };
      }

      const [activeAgent] = await tx
        .update(monitoringAgents)
        .set({ status: "online", lastSeen: now, updatedAt: now })
        .where(
          and(
            eq(monitoringAgents.id, principal.id),
            isNull(monitoringAgents.tokenRevokedAt),
          ),
        )
            .returning({ id: monitoringAgents.id });
      return activeAgent ? { ...activeAgent, recovered: false } : undefined;
    });

    if (!agent) return unauthorized();
    if (agent.recovered) {
      await sendAgentTransitionEmail(agent.id, "recovered", before?.lastSeen ?? null, now);
    }

    const targets = await db
      .select({
        id: printers.id,
        assetTag: printers.assetTag,
        ip: printers.ipAddress,
        serial: printers.serialNumber,
        brand: printers.brand,
        model: printers.model,
        location: locations.name,
      })
      .from(printerMonitoringAssignments)
      .innerJoin(printers, eq(printerMonitoringAssignments.printerId, printers.id))
      .leftJoin(locations, eq(printers.locationId, locations.id))
      .where(eq(printerMonitoringAssignments.agentId, agent.id));

    return NextResponse.json(
      {
        success: true,
        version: 1,
        generatedAt: now.toISOString(),
        refreshAfterSeconds: 60,
        agent: { key: principal.key, name: principal.name },
        printers: targets.map((target) => ({
          id: target.id,
          name: target.assetTag || target.serial,
          ip: target.ip,
          serial: target.serial,
          brand: target.brand,
          model: target.model,
          location: target.location,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Monitoring configuration database error:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to load monitoring configuration" },
      { status: 500 },
    );
  }
}

function unauthorized() {
  return NextResponse.json(
    { success: false, message: "Unauthorized monitoring agent" },
    { status: 401 },
  );
}
