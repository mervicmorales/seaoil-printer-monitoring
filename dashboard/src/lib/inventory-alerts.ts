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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const TONER_ALERT_SUBJECT = "TONER STOCK ALERT!";
const EMAIL_ADVISORY = "The information transmitted is the property of SEAOIL and intended only for the addressee and may contain confidential, proprietary and/or privileged material. Any unauthorized review, distribution or other use of or the taking of any action in reliance upon this information is prohibited. If you received this in error, please contact the sender and delete or destroy this message and any copies.";

export function buildTonerAlertEmail({
  tonerName,
  stock,
  state,
  occurredAt = new Date(),
}: {
  tonerName: string;
  stock: number;
  state: Exclude<InventoryState, "normal">;
  occurredAt?: Date;
}) {
  const unitLabel = stock === 1 ? "unit" : "units";
  const inventoryStatus = state === "critical"
    ? "CRITICAL"
    : state === "empty"
      ? "OUT OF STOCK"
      : null;
  const timestamp = displayTimestamp(occurredAt);
  const statusText = inventoryStatus ? ["", `Inventory Status: ${inventoryStatus}`] : [];
  const text = [
    "ATTENTION Team,",
    "",
    `Please be informed that our current stock of "${tonerName}" is now down to ${stock} ${unitLabel}, which is below our required threshold.`,
    ...statusText,
    "",
    "Please initiate the replenishment process promptly.",
    "",
    `Toner Type: ${tonerName}`,
    `Remaining Stock: ${stock} ${unitLabel}`,
    `Alert Timestamp: ${timestamp}`,
    "",
    `ADVISORY: ${EMAIL_ADVISORY}`,
  ].join("\n");

  const statusColors = state === "empty"
    ? { background: "#fef2f2", border: "#fecaca", label: "#991b1b" }
    : { background: "#fff7ed", border: "#fed7aa", label: "#9a3412" };
  const statusBlock = inventoryStatus
    ? `<tr>
                <td style="padding:0 32px 24px">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${statusColors.background};border:1px solid ${statusColors.border};border-radius:8px">
                    <tr>
                      <td style="padding:14px 16px;color:#6b7280;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">Inventory Status</td>
                      <td align="right" style="padding:14px 16px;color:${statusColors.label};font-size:14px;font-weight:800">${inventoryStatus}</td>
                    </tr>
                  </table>
                </td>
              </tr>`
    : "";

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>${TONER_ALERT_SUBJECT}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f5f7;color:#1f2937;font-family:Arial,Helvetica,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#f3f5f7">
      <tr>
        <td align="center" style="padding:32px 12px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #dde3ea;border-radius:12px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,.06)">
            <tr>
              <td style="height:6px;background:#f58220;font-size:0;line-height:0">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:26px 32px 18px">
                <p style="margin:0 0 8px;color:#014171;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">SEAOIL Printer Management</p>
                <h1 style="margin:0;color:#111827;font-size:25px;line-height:1.25">Toner Stock Alert</h1>
              </td>
            </tr>
            ${statusBlock}
            <tr>
              <td style="padding:0 32px 28px;font-size:15px;line-height:1.7">
                <p style="margin:0 0 16px;font-weight:700;color:#111827">ATTENTION Team,</p>
                <p style="margin:0 0 16px">Please be informed that our current stock of <strong style="color:#014171">&quot;${escapeHtml(tonerName)}&quot;</strong> is now down to <strong style="color:#b45309">${stock} ${unitLabel}</strong>, which is below our required threshold.</p>
                <p style="margin:0 0 24px">Please initiate the replenishment process promptly.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:separate;border-spacing:0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:14px">
                  <tr>
                    <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b;width:42%">Toner Type</td>
                    <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a">${escapeHtml(tonerName)}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;color:#64748b">Remaining Stock</td>
                    <td style="padding:13px 16px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#0f172a">${stock} ${unitLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:13px 16px;color:#64748b">Alert Timestamp</td>
                    <td style="padding:13px 16px;color:#334155">${escapeHtml(timestamp)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#64748b;font-size:11px;line-height:1.6">
                <p style="margin:0"><strong style="color:#475569">ADVISORY:</strong> ${EMAIL_ADVISORY}</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:14px 24px;background:#014171;color:#dbeafe;font-size:11px">This is an automated notification from the SEAOIL Printer Management System.</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject: TONER_ALERT_SUBJECT, text, html };
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
    const email = buildTonerAlertEmail({
      tonerName: row.name,
      stock: row.stock,
      state,
    });
    try {
      await sendEmail({ to: settings.notificationEmail, ...email });
    } catch (error) {
      console.error("Toner inventory email failed:", error instanceof Error ? error.name : "UnknownError");
    }
  }
  return { changed: true as const, state };
}
