"use server";

import { db } from "@/db";
import {
  locations,
  departments,
  itsNames,
  tonerTypes,
  tonerInventory,
  vendors,
  systemSettings,
  auditLogs,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireModuleFullAccess } from "@/lib/server-utils";
import { encryptSecret } from "@/lib/secret-encryption";
import { isValidEmail } from "@/lib/validation";
import { inventoryState } from "@/lib/inventory-alerts";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function revalidateAll() {
  revalidatePath("/system");
  revalidatePath("/overview");
  revalidatePath("/printers");
  revalidatePath("/toner-monitoring");
  revalidatePath("/toner-expenses");
  revalidatePath("/contracts");
  revalidatePath("/repair-history");
}

// ---------- LOCATIONS ----------
export async function addLocationAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  if (name) await db.insert(locations).values({ name }).onConflictDoNothing();
  revalidateAll();
  redirect("/system?tab=locations&success=Location added.");
}
export async function updateLocationAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const name = str(formData.get("name"));
  if (id && name) await db.update(locations).set({ name }).where(eq(locations.id, id));
  revalidateAll();
  redirect("/system?tab=locations&success=Location updated.");
}
export async function deleteLocationAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) await db.delete(locations).where(eq(locations.id, id));
  revalidateAll();
  redirect("/system?tab=locations&success=Location deleted.");
}

// ---------- DEPARTMENTS ----------
export async function addDepartmentAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  if (name) await db.insert(departments).values({ name }).onConflictDoNothing();
  revalidateAll();
  redirect("/system?tab=departments&success=Department added.");
}
export async function updateDepartmentAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const name = str(formData.get("name"));
  if (id && name) await db.update(departments).set({ name }).where(eq(departments.id, id));
  revalidateAll();
  redirect("/system?tab=departments&success=Department updated.");
}
export async function deleteDepartmentAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) await db.delete(departments).where(eq(departments.id, id));
  revalidateAll();
  redirect("/system?tab=departments&success=Department deleted.");
}

// ---------- ITS NAMES ----------
export async function addItsNameAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  if (name) await db.insert(itsNames).values({ name }).onConflictDoNothing();
  revalidateAll();
  redirect("/system?tab=its&success=ITS Name added.");
}
export async function deleteItsNameAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) await db.delete(itsNames).where(eq(itsNames.id, id));
  revalidateAll();
  redirect("/system?tab=its&success=ITS Name deleted.");
}

// ---------- TONER TYPES ----------
export async function addTonerTypeAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  const unitCost = num(formData.get("unitCost")) ?? 0;
  if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > 9_999_999_999.99) {
    redirect("/system?tab=toner&error=Enter a valid non-negative unit cost.");
  }
  if (name) {
    const inserted = await db.insert(tonerTypes).values({
      name,
      unitCost: unitCost.toFixed(2),
    }).onConflictDoNothing().returning();
    if (inserted[0]) {
      await db.insert(tonerInventory).values({ tonerTypeId: inserted[0].id, stock: 0, lowStockThreshold: 5 });
    }
  }
  revalidateAll();
  redirect("/system?tab=toner&success=Toner Type added. Dashboard alert card created.");
}
export async function updateTonerTypeAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const name = str(formData.get("name"));
  const unitCost = num(formData.get("unitCost")) ?? 0;
  if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > 9_999_999_999.99) {
    redirect("/system?tab=toner&error=Enter a valid non-negative unit cost.");
  }
  if (id && name) {
    await db
      .update(tonerTypes)
      .set({ name, unitCost: unitCost.toFixed(2) })
      .where(eq(tonerTypes.id, id));
  }
  revalidateAll();
  redirect("/system?tab=toner&success=Toner type and unit cost updated.");
}
export async function deleteTonerTypeAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) await db.delete(tonerTypes).where(eq(tonerTypes.id, id));
  revalidateAll();
  redirect("/system?tab=toner&success=Toner Type deleted. Dashboard alert card removed.");
}
export async function updateThresholdAction(formData: FormData) {
  await requireModuleFullAccess("system");
  const id = num(formData.get("tonerTypeId"));
  const threshold = num(formData.get("threshold"));
  const criticalThreshold = num(formData.get("criticalThreshold"));
  if (id && threshold !== null && criticalThreshold !== null && criticalThreshold > threshold) {
    redirect("/system?tab=toner&error=Critical threshold must not exceed the low threshold.");
  }
  if (id && threshold !== null && criticalThreshold !== null) {
    const [inventory] = await db.select({ stock: tonerInventory.stock }).from(tonerInventory).where(eq(tonerInventory.tonerTypeId, id)).limit(1);
    await db.update(tonerInventory).set({
      lowStockThreshold: threshold,
      criticalStockThreshold: criticalThreshold,
      alertState: inventoryState(inventory?.stock ?? 0, threshold, criticalThreshold),
    }).where(eq(tonerInventory.tonerTypeId, id));
  }
  revalidateAll();
  redirect("/system?tab=toner&success=Inventory thresholds updated.");
}
export async function updateAlertCardVisibilityAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("tonerTypeId"));
  if (id) {
    await db
      .update(tonerTypes)
      .set({ showAlertCard: formData.get("showAlertCard") === "on" })
      .where(eq(tonerTypes.id, id));
  }
  revalidateAll();
  redirect("/system?tab=toner&success=Alert card visibility updated.");
}

// ---------- VENDORS ----------
export async function addVendorAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  if (name) {
    await db.insert(vendors).values({
      name,
      email: str(formData.get("email")),
      mobile: str(formData.get("mobile")),
      accountManager: str(formData.get("accountManager")),
    });
  }
  revalidateAll();
  redirect("/system?tab=vendors&success=Vendor added.");
}
export async function updateVendorAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) {
    await db
      .update(vendors)
      .set({
        name: str(formData.get("name")) || "",
        email: str(formData.get("email")),
        mobile: str(formData.get("mobile")),
        accountManager: str(formData.get("accountManager")),
      })
      .where(eq(vendors.id, id));
  }
  revalidateAll();
  redirect("/system?tab=vendors&success=Vendor updated.");
}
export async function deleteVendorAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) await db.delete(vendors).where(eq(vendors.id, id));
  revalidateAll();
  redirect("/system?tab=vendors&success=Vendor deleted.");
}

// ---------- SETTINGS ----------
export async function updateSettingsAction(formData: FormData) {
  const admin = await requireAdmin("system");
  const rows = await db.select().from(systemSettings).limit(1);
  
  // Validate comma-separated emails
  const emailInput = str(formData.get("notificationEmail")) || "itservicedesk@seaoil.com.ph";
  const emails = emailInput.split(",").map(e => e.trim()).filter(e => e);
  const invalidEmails = emails.filter(e => !isValidEmail(e));
  if (invalidEmails.length > 0) {
    redirect(`/system?tab=reminders&error=Invalid email address: ${invalidEmails[0]}`);
  }
  
  const values = {
    notificationEmail: emails.join(", "),
    defaultLowStockThreshold: num(formData.get("defaultLowStockThreshold")) ?? 5,
    emailReminderEnabled: formData.get("emailReminderEnabled") === "on",
    systemNotificationEnabled: formData.get("systemNotificationEnabled") === "on",
    agentOfflineThresholdMinutes: Math.max(1, Math.min(1440, num(formData.get("agentOfflineThresholdMinutes")) ?? 5)),
    tonerLowEmailEnabled: formData.get("tonerLowEmailEnabled") === "on",
    tonerCriticalEmailEnabled: formData.get("tonerCriticalEmailEnabled") === "on",
    tonerEmptyEmailEnabled: formData.get("tonerEmptyEmailEnabled") === "on",
    agentOfflineEmailEnabled: formData.get("agentOfflineEmailEnabled") === "on",
    agentRecoveredEmailEnabled: formData.get("agentRecoveredEmailEnabled") === "on",
  };
  if (rows.length) {
    await db.update(systemSettings).set(values).where(eq(systemSettings.id, rows[0].id));
  } else {
    await db.insert(systemSettings).values(values);
  }
  await db.insert(auditLogs).values({ actorUserId: admin.id, action: "notifications.settings_changed", targetType: "system_settings" });
  revalidateAll();
  redirect("/system?tab=reminders&success=Settings saved.");
}

export async function updateSmtpSettingsAction(formData: FormData) {
  const admin = await requireAdmin("system");
  const [existing] = await db.select().from(systemSettings).limit(1);
  const enabled = formData.get("smtpEnabled") === "on";
  const host = str(formData.get("smtpHost"));
  const port = num(formData.get("smtpPort"));
  const security = str(formData.get("smtpSecurity")) || "none";
  const username = str(formData.get("smtpUsername"));
  const password = String(formData.get("smtpPassword") ?? "");
  const from = str(formData.get("smtpFrom"));
  const fromName = str(formData.get("smtpFromName"));
  const testRecipient = str(formData.get("smtpTestRecipient"));
  if (enabled && (!host || !port || port < 1 || port > 65535 || !from || !isValidEmail(from) || !fromName || !["none", "starttls", "tls"].includes(security))) {
    redirect("/system?tab=email&error=Complete all required SMTP fields with valid values.");
  }
  if (testRecipient && !isValidEmail(testRecipient)) redirect("/system?tab=email&error=Test recipient must be a valid email.");
  if (username && !password && !existing?.smtpPasswordEncrypted) redirect("/system?tab=email&error=Enter the SMTP password.");
  if (!username && password) redirect("/system?tab=email&error=SMTP username is required when setting a password.");
  let encryptedPassword = existing?.smtpPasswordEncrypted ?? null;
  if (password) encryptedPassword = encryptSecret(password);
  if (!username) encryptedPassword = null;
  const values = { smtpEnabled: enabled, smtpHost: host, smtpPort: port, smtpSecurity: security, smtpUsername: username, smtpPasswordEncrypted: encryptedPassword, smtpFrom: from, smtpFromName: fromName, smtpTestRecipient: testRecipient, updatedAt: new Date(), updatedBy: admin.id };
  if (existing) await db.update(systemSettings).set(values).where(eq(systemSettings.id, existing.id));
  else await db.insert(systemSettings).values(values);
  await db.insert(auditLogs).values({ actorUserId: admin.id, action: "smtp.settings_changed", targetType: "system_settings", metadata: { enabled, host, port, security, passwordChanged: Boolean(password) } });
  revalidateAll();
  redirect("/system?tab=email&success=SMTP settings saved.");
}
