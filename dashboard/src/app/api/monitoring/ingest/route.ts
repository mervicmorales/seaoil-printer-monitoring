import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  monitoringAgents,
  notifications,
  printerAlerts,
  printerConsumableReadings,
  printerMonitoringAssignments,
  printerMonitoringReadings,
  printers,
  systemSettings,
} from "@/db/schema";
import {
  authenticateMonitoringAgent,
  monitoringPayloadSchema,
  normalizeAlerts,
  normalizeConsumables,
  parseUptimeSeconds,
} from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = monitoringPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid monitoring payload",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const payload = parsed.data;
  const receivedAt = new Date();
  const maximumAcceptedTime = receivedAt.getTime() + 5 * 60 * 1_000;
  const timestamps = [
    { path: "sentAt", value: payload.sentAt },
    ...payload.printers
      .map((printer, index) => ({
        path: `printers.${index}.lastChecked`,
        value: printer.lastChecked,
      }))
      .filter((item): item is { path: string; value: string } => Boolean(item.value)),
  ];
  const futureTimestamp = timestamps.find(
    ({ value }) => new Date(value).getTime() > maximumAcceptedTime,
  );
  if (futureTimestamp) {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid monitoring payload",
        issues: [
          {
            path: futureTimestamp.path,
            message: "Timestamp is too far in the future",
          },
        ],
      },
      { status: 400 },
    );
  }

  let authentication;
  try {
    authentication = await authenticateMonitoringAgent(
      request.headers.get("authorization"),
      payload.agent.key,
    );
  } catch (error) {
    console.error(
      "Monitoring authentication database error:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to authenticate monitoring agent" },
      { status: 500 },
    );
  }

  if (authentication.status === "unauthorized") {
    return NextResponse.json(
      { success: false, message: "Unauthorized monitoring agent" },
      { status: 401 },
    );
  }

  try {
    const result = await db.transaction(async (tx) => {
      const principal = authentication.principal;
      const [recoveredAgent] = await tx
        .update(monitoringAgents)
        .set({
          hostname: payload.agent.hostname ?? null,
          version: payload.agent.version ?? null,
          status: "online",
          lastSeen: receivedAt,
          updatedAt: receivedAt,
        })
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
      }

      const [activeAgent] = recoveredAgent
        ? [recoveredAgent]
        : await tx
            .update(monitoringAgents)
            .set({
              hostname: payload.agent.hostname ?? null,
              version: payload.agent.version ?? null,
              status: "online",
              lastSeen: receivedAt,
              updatedAt: receivedAt,
            })
            .where(
              and(
                eq(monitoringAgents.id, principal.id),
                isNull(monitoringAgents.tokenRevokedAt),
              ),
            )
            .returning({ id: monitoringAgents.id });

      if (!activeAgent) {
        throw new Error("MonitoringAgentCredentialChanged");
      }

      const agent = activeAgent;

      const matched: Array<{
        printerId: number;
        monitoringReadingId: number;
        matchedBy: "serial" | "assetTag" | "ip";
      }> = [];
      const unmatched: Array<{
        name: string;
        serial: string | null;
        ip: string;
        reason:
          | "not-found"
          | "not-assigned"
          | "ambiguous-asset-tag"
          | "ambiguous-ip";
      }> = [];

      for (const observation of payload.printers) {
        let printerId: number | null = null;
        let matchedBy: "serial" | "assetTag" | "ip" | null = null;
        let ambiguousReason: "ambiguous-asset-tag" | "ambiguous-ip" | null = null;

        if (observation.serial) {
          const [serialMatch] = await tx
            .select({ id: printers.id })
            .from(printers)
            .where(eq(printers.serialNumber, observation.serial))
            .limit(1);
          if (serialMatch) {
            printerId = serialMatch.id;
            matchedBy = "serial";
          }
        }

        if (!printerId && observation.assetTag) {
          const assetMatches = await tx
            .select({ id: printers.id })
            .from(printers)
            .where(eq(printers.assetTag, observation.assetTag))
            .limit(2);
          if (assetMatches.length === 1) {
            printerId = assetMatches[0].id;
            matchedBy = "assetTag";
          } else if (assetMatches.length > 1) {
            ambiguousReason = "ambiguous-asset-tag";
          }
        }

        if (!printerId && !ambiguousReason) {
          const ipMatches = await tx
            .select({ id: printers.id })
            .from(printers)
            .where(eq(printers.ipAddress, observation.ip))
            .limit(2);
          if (ipMatches.length === 1) {
            printerId = ipMatches[0].id;
            matchedBy = "ip";
          } else if (ipMatches.length > 1) {
            ambiguousReason = "ambiguous-ip";
          }
        }

        if (!printerId || !matchedBy) {
          unmatched.push({
            name: observation.name,
            serial: observation.serial ?? null,
            ip: observation.ip,
            reason: ambiguousReason ?? "not-found",
          });
          continue;
        }

        const [assignment] = await tx
          .select({ printerId: printerMonitoringAssignments.printerId })
          .from(printerMonitoringAssignments)
          .where(
            and(
              eq(printerMonitoringAssignments.printerId, printerId),
              eq(printerMonitoringAssignments.agentId, agent.id),
            ),
          )
          .limit(1);
        if (!assignment) {
          unmatched.push({
            name: observation.name,
            serial: observation.serial ?? null,
            ip: observation.ip,
            reason: "not-assigned",
          });
          continue;
        }

        const checkedAt = new Date(observation.lastChecked ?? payload.sentAt);
        const [reading] = await tx
          .insert(printerMonitoringReadings)
          .values({
            printerId,
            agentId: agent.id,
            checkedAt,
            online: observation.online,
            printerStatus: observation.status ?? null,
            responseTimeMs: observation.responseTimeMs ?? null,
            pageCount: observation.pages ?? null,
            uptimeSeconds: parseUptimeSeconds(
              observation.uptime,
              observation.uptimeSeconds,
            ),
            errorStatus: observation.errorStatus ?? null,
            errorMessage: observation.errorMessage ?? null,
          })
          .returning({ id: printerMonitoringReadings.id });

        const consumables = normalizeConsumables(observation);
        if (consumables.length > 0) {
          await tx.insert(printerConsumableReadings).values(
            consumables.map((consumable) => ({
              ...consumable,
              printerId,
              monitoringReadingId: reading.id,
              checkedAt,
            })),
          );
        }

        const currentAlerts = normalizeAlerts(observation);
        const openAlerts = await tx
          .select({
            id: printerAlerts.id,
            type: printerAlerts.type,
            message: printerAlerts.message,
          })
          .from(printerAlerts)
          .where(
            and(
              eq(printerAlerts.printerId, printerId),
              eq(printerAlerts.agentId, agent.id),
              isNull(printerAlerts.resolvedAt),
            ),
          );
        const currentAlertKeys = new Set(
          currentAlerts.map((alert) => `${alert.type}\u0000${alert.message}`),
        );
        const openAlertKeys = new Set(
          openAlerts.map((alert) => `${alert.type}\u0000${alert.message}`),
        );

        for (const openAlert of openAlerts) {
          const key = `${openAlert.type}\u0000${openAlert.message}`;
          if (!currentAlertKeys.has(key)) {
            await tx
              .update(printerAlerts)
              .set({ resolvedAt: checkedAt, updatedAt: receivedAt })
              .where(eq(printerAlerts.id, openAlert.id));
          }
        }

        const newAlerts = currentAlerts.filter(
          (alert) => !openAlertKeys.has(`${alert.type}\u0000${alert.message}`),
        );
        if (newAlerts.length > 0) {
          await tx.insert(printerAlerts).values(
            newAlerts.map((alert) => ({
              ...alert,
              printerId,
              agentId: agent.id,
              startedAt: checkedAt,
              updatedAt: receivedAt,
            })),
          );
        }

        matched.push({
          printerId,
          monitoringReadingId: reading.id,
          matchedBy,
        });
      }

      return { agentId: agent.id, matched, unmatched };
    });

    if (result.unmatched.length > 0) {
      console.warn(
        `Monitoring ingest accepted with ${result.unmatched.length} unmatched printer(s)`,
      );
    }

    return NextResponse.json({
      success: true,
      message: "Monitoring data persisted",
      agentId: result.agentId,
      matched: result.matched,
      unmatched: result.unmatched,
    });
  } catch (error) {
    console.error(
      "Monitoring ingest database error:",
      error instanceof Error ? error.name : "UnknownError",
    );
    return NextResponse.json(
      { success: false, message: "Unable to persist monitoring data" },
      { status: 500 },
    );
  }
}
