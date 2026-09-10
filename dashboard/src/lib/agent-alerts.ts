import "server-only";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { locations, monitoringAgents, systemSettings } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { buildAgentStatusEmail } from "@/lib/email-templates";

function formatManila(value: Date | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "Asia/Manila",
  }).format(value);
}

export async function sendAgentTransitionEmail(
  agentId: number,
  transition: "offline" | "recovered",
  previousLastSeen: Date | null,
  occurredAt: Date,
) {
  const [[agent], [settings]] = await Promise.all([
    db.select({
      key: monitoringAgents.agentKey,
      name: monitoringAgents.name,
      location: locations.name,
    }).from(monitoringAgents)
      .leftJoin(locations, eq(locations.id, monitoringAgents.locationId))
      .where(eq(monitoringAgents.id, agentId)).limit(1),
    db.select().from(systemSettings).limit(1),
  ]);
  if (!agent || !settings?.notificationEmail || settings.emailReminderEnabled === false) return;
  if (transition === "offline" && settings.agentOfflineEmailEnabled === false) return;
  if (transition === "recovered" && settings.agentRecoveredEmailEnabled === false) return;

  const email = buildAgentStatusEmail({
    transition,
    agentName: agent.name,
    agentKey: agent.key,
    location: agent.location || "Not assigned",
    previousLastSeen: formatManila(previousLastSeen),
    occurredAt: formatManila(occurredAt),
  });
  try {
    await sendEmail({
      to: settings.notificationEmail,
      ...email,
    });
  } catch (error) {
    console.error("Monitoring agent email failed:", error instanceof Error ? error.name : "UnknownError");
  }
}
