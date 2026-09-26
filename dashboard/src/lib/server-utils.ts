import "server-only";
import { db } from "@/db";
import { notifications, systemSettings, userModuleAccess } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MODULES, resolveModuleAccess, type ModuleName } from "@/lib/permissions";
import { hasAdminPrivileges, isSuperAdmin, type UserRole } from "@/lib/roles";

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function getModuleAccessMap(userId: number, role: UserRole) {
  if (isSuperAdmin(role)) {
    return Object.fromEntries(MODULES.map((module) => [module, true])) as Record<
      ModuleName,
      boolean
    >;
  }
  const rows = await db
    .select()
    .from(userModuleAccess)
    .where(eq(userModuleAccess.userId, userId));
  return resolveModuleAccess(rows);
}

export async function requireModuleFullAccess(module: ModuleName) {
  const session = await requireSession();
  const map = await getModuleAccessMap(session.id, session.role);
  if (!map[module]) {
    redirect("/access-denied");
  }
  return session;
}

export async function requireAdmin(module: ModuleName) {
  const session = await requireSession();
  if (!hasAdminPrivileges(session.role)) {
    redirect("/access-denied");
  }
  const map = await getModuleAccessMap(session.id, session.role);
  if (!map[module]) {
    redirect("/access-denied");
  }
  return session;
}

export async function generateTicketNumber() {
  const prefix = "PR";
  const next = await db.execute<{ number: string }>(
    sql`select nextval('repair_ticket_sequence')::text as number`,
  );
  const n = Number(next.rows[0]?.number);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error("Could not allocate a repair ticket number");
  return `${prefix}${String(n).padStart(6, "0")}`;
}

export async function createNotification(message: string, type = "info") {
  const settings = await getSystemSettings();
  if (!settings.systemNotificationEnabled) return;
  await db.insert(notifications).values({ message, type });
}

export async function getSystemSettings() {
  const rows = await db.select().from(systemSettings).limit(1);
  if (rows.length) return rows[0];
  const inserted = await db
    .insert(systemSettings)
    .values({})
    .returning();
  return inserted[0];
}
