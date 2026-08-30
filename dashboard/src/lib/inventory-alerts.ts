import "server-only";

import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { notifications, systemSettings, tonerInventory, tonerTypes } from "@/db/schema";
import { sendEmail } from "@/lib/email";

export type InventoryState = "normal" | "low" | "critical" | "empty";

export function inventoryState(stock: number, low: number, critical: number): InventoryState {
  if (stock <= 0) return "empty";
  if (stock <= critical) return "critical";
  if (stock <= low) return "low";
  return "normal";
}

function displayTimestamp(date: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "Asia/Manila",
  }).format(date);
}

export async function processTonerInventoryAlert(tonerTypeId: number) {
  const [row] = await db
    .select({
      stock: tonerInventory.stock,
      low: tonerInventory.lowStockThreshold,
      critical: tonerInventory.criticalStockThreshold,
      previous: tonerInventory.alertState,
      name: tonerTypes.name,
    })
    .from(tonerInventory)
    .innerJoin(tonerTypes, eq(tonerTypes.id, tonerInventory.tonerTypeId))
    .where(eq(tonerInventory.tonerTypeId, tonerTypeId))
    .limit(1);
  if (!row) return { changed: false as const, state: "normal" as InventoryState };

  const state = inventoryState(row.stock, row.low, row.critical);
  if (row.previous === state) return { changed: false as const, state };
  const previous = (["normal", "low", "critical", "empty"] as const).includes(row.previous as InventoryState)
    ? row.previous as InventoryState
    : "normal";

  const changed = await db
    .update(tonerInventory)
    .set({ alertState: state })
    .where(and(eq(tonerInventory.tonerTypeId, tonerTypeId), ne(tonerInventory.alertState, state)))
    .returning({ id: tonerInventory.id });
  const severity: Record<InventoryState, number> = { normal: 0, low: 1, critical: 2, empty: 3 };
  if (!changed.length || severity[state] <= severity[previous]) return { changed: changed.length > 0, state };
  if (state === "normal") return { changed: true as const, state };

  const [settings] = await db.select().from(systemSettings).limit(1);
  const labels = { low: "LOW", critical: "CRITICAL", empty: "OUT OF STOCK" } as const;
  const subjects = {
    low: "SEAOIL Printer - Low Toner Inventory",
    critical: "SEAOIL Printer - Critical Toner Inventory",
    empty: "SEAOIL Printer - Toner Inventory Empty",
  } as const;
  const enabled = {
    low: settings?.tonerLowEmailEnabled !== false,
    critical: settings?.tonerCriticalEmailEnabled !== false,
    empty: settings?.tonerEmptyEmailEnabled !== false,
  } as const;
  const message = `Toner inventory ${row.name} is ${labels[state]} at ${row.stock} unit(s).`;

  if (settings?.systemNotificationEnabled !== false) {
    await db.insert(notifications).values({ message, type: `toner-inventory-${state}` });
  }
  if (enabled[state] && settings?.emailReminderEnabled !== false && settings?.notificationEmail) {
    const text = [
      `Toner: ${row.name}`,
      `Inventory Status: ${labels[state]}`,
      `Current Quantity: ${row.stock}`,
      `Low Threshold: ${row.low}`,
      `Critical Threshold: ${row.critical}`,
      "Location: Global inventory",
      `Timestamp: ${displayTimestamp(new Date())}`,
      "",
      state === "low"
        ? "Toner inventory has reached the configured low-stock threshold."
        : state === "critical"
          ? "Toner inventory has reached the configured critical-stock threshold."
          : "Toner inventory is out of stock.",
      "Please review the Toner Inventory module for replenishment.",
    ].join("\n");
    try {
      await sendEmail({ to: settings.notificationEmail, subject: subjects[state], text });
    } catch (error) {
      console.error("Toner inventory email failed:", error instanceof Error ? error.name : "UnknownError");
    }
  }
  return { changed: true as const, state };
}
