"use server";

import { and, eq, isNotNull, isNull, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { monitoringAgents, printerDiscoveryScans } from "@/db/schema";
import { requireModuleFullAccess } from "@/lib/server-utils";

export async function queueDiscoveryScanAction(formData: FormData) {
  const session = await requireModuleFullAccess("printers");
  const agentId = Number(String(formData.get("agentId") ?? ""));
  const subnet = String(formData.get("subnet") ?? "").trim();

  if (!Number.isSafeInteger(agentId) || agentId < 1) {
    redirect("/printdash/discover?error=Select+a+monitoring+agent.");
  }
  if (!isValidIpv4Slash24(subnet)) {
    redirect("/printdash/discover?error=Use+network+format+172.16.x.0%2F24.+A+%2F24+scan+checks+addresses+.1+through+.254.");
  }

  const [agent] = await db
    .select({ id: monitoringAgents.id })
    .from(monitoringAgents)
    .where(
      and(
        eq(monitoringAgents.id, agentId),
        isNotNull(monitoringAgents.tokenHash),
        isNull(monitoringAgents.tokenRevokedAt),
      ),
    )
    .limit(1);
  if (!agent) redirect("/printdash/discover?error=The+selected+agent+is+not+available.");

  const active = await db
    .select({ id: printerDiscoveryScans.id })
    .from(printerDiscoveryScans)
    .where(
      and(
        eq(printerDiscoveryScans.agentId, agentId),
        inArray(printerDiscoveryScans.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (active.length > 0) {
    redirect("/printdash/discover?error=That+agent+already+has+a+scan+in+progress.");
  }

  await db.insert(printerDiscoveryScans).values({
    agentId,
    requestedBy: session.id,
    subnet,
  });
  revalidatePath("/printdash/discover");
  redirect("/printdash/discover?success=Network+scan+queued.+The+agent+will+start+it+shortly.");
}

function isValidIpv4Slash24(value: string) {
  const match = value.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.0\/24$/);
  return Boolean(match && match.slice(1).every((part) => Number(part) <= 255));
}
