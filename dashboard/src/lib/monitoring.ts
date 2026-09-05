import "server-only";

import { isIP } from "net";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { monitoringAgents } from "@/db/schema";
import { normalizeMacAddress } from "@/lib/mac-address";

const shortText = z.string().trim().min(1).max(255);
const optionalShortText = shortText.nullish();
const counter = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER)
  .nullish();
const dateTime = z.string().datetime({ offset: true });
export const monitoringAgentKeySchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/,
    "Agent key must be 1-100 letters, numbers, dots, underscores, colons, or hyphens",
  );

const tonerSchema = z.object({
  name: shortText,
  type: optionalShortText,
  pct: z.number().int().min(0).max(100).nullish(),
  status: optionalShortText,
  unknown: z.boolean().optional().default(false),
});

// Tray values are validated so special SNMP integers such as -3 can pass
// through without being mistaken for a genuine quantity. Tray history is not
// persisted until a dedicated tray-reading model is introduced.
const traySchema = z.object({
  name: shortText,
  capacity: z.number().int().nullish(),
  level: z.number().int().nullish(),
  pct: z.number().int().min(0).max(100).nullish(),
  status: optionalShortText,
});

const alertSchema = z.union([
  z.string().trim().min(1).max(1_000),
  z.object({
    type: optionalShortText,
    severity: optionalShortText,
    desc: z.string().trim().min(1).max(1_000).nullish(),
    message: z.string().trim().min(1).max(1_000).nullish(),
  }),
]);

const printerObservationSchema = z.object({
  name: shortText,
  ip: z
    .string()
    .trim()
    .max(255)
    .refine((value) => isIP(value) !== 0, "Invalid printer IP address"),
  serial: optionalShortText,
  macAddress: z.string().max(64).nullish().transform(normalizeMacAddress),
  assetTag: optionalShortText,
  online: z.boolean(),
  status: optionalShortText,
  model: optionalShortText,
  pages: counter,
  uptime: z.string().trim().max(100).nullish(),
  uptimeSeconds: counter,
  responseTimeMs: z.number().int().min(0).max(86_400_000).nullish(),
  errorStatus: optionalShortText,
  errorMessage: z.string().trim().max(2_000).nullish(),
  toners: z.array(tonerSchema).max(64).optional().default([]),
  trays: z.array(traySchema).max(64).optional().default([]),
  alerts: z.array(alertSchema).max(128).optional().default([]),
  lastChecked: dateTime.nullish(),
});

export const monitoringPayloadSchema = z.object({
  agent: z.object({
    key: monitoringAgentKeySchema,
    name: shortText,
    hostname: optionalShortText,
    version: optionalShortText,
    location: optionalShortText,
  }),
  sentAt: dateTime,
  printers: z.array(printerObservationSchema).min(1).max(100),
});

export type MonitoringPayload = z.infer<typeof monitoringPayloadSchema>;
export type PrinterObservation = MonitoringPayload["printers"][number];

export type MonitoringAgentPrincipal = {
  id: number;
  key: string;
  name: string;
};

export type MonitoringAuthentication =
  | { status: "authenticated"; principal: MonitoringAgentPrincipal }
  | { status: "unauthorized" };

// Used for unknown/revoked agents so credential checks still perform a bcrypt
// comparison and do not expose which part of the credentials was incorrect.
const DUMMY_TOKEN_HASH =
  "$2b$12$2be.xiUfvbVJG.Ds11WqWOluuGRp40PjNwq.QGjVZHxGQL/WYGOzS";
const TOKEN_PATTERN = /^[A-Za-z0-9._~-]{32,256}$/;

export async function authenticateMonitoringAgent(
  authorizationHeader: string | null,
  requestedAgentKey: string,
): Promise<MonitoringAuthentication> {
  const match = authorizationHeader?.match(/^Bearer\s+(.+)$/i);
  const receivedToken = match?.[1]?.trim() ?? "";
  const tokenHasValidFormat = TOKEN_PATTERN.test(receivedToken);

  const [agent] = await db
    .select({
      id: monitoringAgents.id,
      key: monitoringAgents.agentKey,
      name: monitoringAgents.name,
      tokenHash: monitoringAgents.tokenHash,
      tokenRevokedAt: monitoringAgents.tokenRevokedAt,
    })
    .from(monitoringAgents)
    .where(eq(monitoringAgents.agentKey, requestedAgentKey))
    .limit(1);

  const candidateHash = agent?.tokenHash ?? DUMMY_TOKEN_HASH;
  const tokenMatches = await bcrypt.compare(
    tokenHasValidFormat ? receivedToken : "invalid-monitoring-token-placeholder",
    candidateHash,
  );

  if (
    !tokenHasValidFormat ||
    !agent ||
    !agent.tokenHash ||
    agent.tokenRevokedAt !== null ||
    !tokenMatches
  ) {
    return { status: "unauthorized" };
  }

  return {
    status: "authenticated",
    principal: {
      id: agent.id,
      key: agent.key,
      name: agent.name,
    },
  };
}

export function parseUptimeSeconds(
  uptime: string | null | undefined,
  suppliedSeconds: number | null | undefined,
) {
  if (suppliedSeconds !== null && suppliedSeconds !== undefined) {
    return suppliedSeconds;
  }
  if (!uptime) return null;

  const match = uptime
    .trim()
    .match(/^(?:(\d+)d\s*)?(?:(\d+)h\s*)?(?:(\d+)m\s*)?$/i);
  if (!match || !match.slice(1).some((part) => part !== undefined)) return null;

  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = days * 86_400 + hours * 3_600 + minutes * 60;
  return Number.isSafeInteger(seconds) ? seconds : null;
}

export function inferConsumableType(name: string, suppliedType?: string | null) {
  if (suppliedType) return suppliedType.toLowerCase();
  const normalized = name.toLowerCase();
  if (normalized.includes("drum")) return "drum";
  if (normalized.includes("fuser")) return "fuser";
  if (normalized.includes("belt")) return "transfer-belt";
  if (normalized.includes("waste")) return "waste-toner";
  if (normalized.includes("maintenance") || normalized.includes("kit")) {
    return "maintenance-kit";
  }
  return "toner";
}

export function normalizeConsumables(observation: PrinterObservation) {
  return observation.toners.map((toner) => {
    const isUnknown = toner.unknown || toner.pct === null || toner.pct === undefined;
    return {
      name: toner.name,
      type: inferConsumableType(toner.name, toner.type),
      levelPercent: isUnknown ? null : toner.pct,
      status:
        toner.status ??
        (isUnknown
          ? "Unknown"
          : toner.pct === 0
            ? "Empty"
            : toner.pct !== null && toner.pct !== undefined && toner.pct <= 10
              ? "Low"
              : "OK"),
      isUnknown,
    };
  });
}

function inferAlertType(message: string, suppliedType?: string | null) {
  if (suppliedType) return suppliedType.toLowerCase().replace(/\s+/g, "-");
  const normalized = message.toLowerCase();
  if (normalized.includes("offline")) return "printer-offline";
  if (normalized.includes("recover") || normalized.includes("back online")) {
    return "printer-recovered";
  }
  if (normalized.includes("empty") && normalized.includes("toner")) {
    return "toner-empty";
  }
  if (normalized.includes("low") && normalized.includes("toner")) {
    return "low-toner";
  }
  if (normalized.includes("jam")) return "paper-jam";
  if (
    normalized.includes("paper out") ||
    normalized.includes("paper empty") ||
    (normalized.includes("tray") && normalized.includes("empty"))
  ) {
    return "paper-empty";
  }
  if (normalized.includes("tray") && normalized.includes("missing")) {
    return "tray-missing";
  }
  if (normalized.includes("output") && normalized.includes("full")) {
    return "output-full";
  }
  if (normalized.includes("cover") && normalized.includes("open")) {
    return "cover-open";
  }
  if (normalized.includes("maintenance") || normalized.includes("service")) {
    return "maintenance-warning";
  }
  if (normalized.includes("error")) return "printer-error";
  return "printer-alert";
}

function normalizeSeverity(severity?: string | null) {
  const normalized = severity?.trim().toLowerCase();
  if (normalized === "critical" || normalized === "fatal") return "critical";
  if (normalized === "error" || normalized === "major") return "error";
  if (normalized === "warning" || normalized === "warn" || normalized === "minor") {
    return "warning";
  }
  return "info";
}

export type NormalizedMonitoringAlert = {
  type: string;
  severity: string;
  message: string;
};

export function normalizeAlerts(observation: PrinterObservation) {
  const reportedAlerts: NormalizedMonitoringAlert[] = observation.alerts.map((alert) => {
    if (typeof alert === "string") {
      return {
        type: inferAlertType(alert),
        severity: "warning",
        message: alert,
      };
    }
    const message = alert.message ?? alert.desc ?? "Printer alert";
    return {
      type: inferAlertType(message, alert.type),
      severity: normalizeSeverity(alert.severity),
      message,
    };
  });
  const alerts = [...reportedAlerts];

  if (observation.online) {
    const reportedTypes = new Set(reportedAlerts.map((alert) => alert.type));

    if (!reportedTypes.has("toner-empty") && !reportedTypes.has("low-toner")) {
      for (const toner of observation.toners) {
        if (toner.unknown || toner.pct === null || toner.pct === undefined) continue;
        const normalizedStatus = toner.status?.trim().toLowerCase();

        if (toner.pct === 0 || normalizedStatus === "empty") {
          alerts.push({
            type: "toner-empty",
            severity: "error",
            message: `${toner.name} is empty`,
          });
        } else if (toner.pct <= 20 || normalizedStatus === "low") {
          alerts.push({
            type: "low-toner",
            severity: "warning",
            message: `${toner.name} is low`,
          });
        }
      }
    }

    if (!reportedTypes.has("paper-empty")) {
      for (const tray of observation.trays) {
        if (tray.pct === 0) {
          alerts.push({
            type: "paper-empty",
            severity: "warning",
            message: `${tray.name} is empty`,
          });
        }
      }
    }

    const errorMessage = observation.errorMessage?.trim();
    const errorStatus = observation.errorStatus?.trim();
    const stopped = observation.status?.trim().toLowerCase() === "stopped";
    if (!reportedTypes.has("printer-error") && (errorMessage || errorStatus || stopped)) {
      alerts.push({
        type: "printer-error",
        severity: "error",
        message: errorMessage || errorStatus || "Printer status is stopped",
      });
    }
  }

  if (!observation.online) {
    alerts.push({
      type: "printer-offline",
      severity: "error",
      message: "Printer is offline",
    });
  }

  return [...new Map(alerts.map((alert) => [`${alert.type}\u0000${alert.message}`, alert])).values()];
}
