import "server-only";
import { db } from "@/db";
import { notifications, systemSettings, tonerInventory, tonerTypes, userModuleAccess } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { sendEmail } from "@/lib/email";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import type { ModuleName } from "@/lib/permissions";

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function getModuleAccessMap(userId: number, role: "admin" | "user") {
  if (role === "admin") {
    return {
      dashboard: true,
      printers: true,
      toner: true,
      contract: true,
      repair: true,
      system: true,
    } as Record<ModuleName, boolean>;
  }
  const rows = await db
    .select()
    .from(userModuleAccess)
    .where(eq(userModuleAccess.userId, userId));
  const map = {
    dashboard: false,
    printers: false,
    toner: false,
    contract: false,
    repair: false,
    system: false,
  } as Record<ModuleName, boolean>;
  for (const row of rows) {
    map[row.module as ModuleName] = row.fullAccess;
  }
  return map;
}

export async function requireModuleFullAccess(module: ModuleName) {
  const session = await requireSession();
  const map = await getModuleAccessMap(session.id, session.role);
  if (!map[module]) {
    redirect("/access-denied");
  }
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.role !== "admin") {
    redirect("/access-denied");
  }
  return session;
}

export async function generateTicketNumber() {
  const prefix = "PR";
  const count = await db.execute<{ count: string }>(
    sql`select coalesce(max(substring(ticket_number from '^PR([0-9]{6})$')::integer), 0)::text as count from repair_tickets`,
  );
  const n = parseInt(count.rows[0]?.count ?? "0", 10) + 1;
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

export async function checkLowStockAndNotify(tonerTypeId: number) {
  const settings = await getSystemSettings();
  const rows = await db
    .select({
      stock: tonerInventory.stock,
      threshold: tonerInventory.lowStockThreshold,
      name: tonerTypes.name,
    })
    .from(tonerInventory)
    .innerJoin(tonerTypes, eq(tonerInventory.tonerTypeId, tonerTypes.id))
    .where(eq(tonerInventory.tonerTypeId, tonerTypeId))
    .limit(1);
  const row = rows[0];
  if (!row) return;
  if (row.stock <= row.threshold) {
    const message = `Low stock alert: ${row.name} is at ${row.stock} unit(s), at or below the threshold of ${row.threshold}.`;
    if (settings.systemNotificationEnabled) {
      await db.insert(notifications).values({ message, type: "low-stock" });
    }
    if (settings.emailReminderEnabled && settings.notificationEmail) {
      await sendEmail(settings.notificationEmail, `[SEAOIL] Low Toner Stock: ${row.name}`, message);
    }
  }
}
