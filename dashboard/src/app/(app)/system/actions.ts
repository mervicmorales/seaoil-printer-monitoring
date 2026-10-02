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
  costCenters,
  monitoringAgents,
  organizationMappings,
  printers,
  repairTickets,
  subunits,
  tonerTransactions,
  userRegistrationRequests,
  users,
} from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
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
  revalidatePath("/system/notifications");
  revalidatePath("/system/organization");
  revalidatePath("/system/toner-types");
  revalidatePath("/system/its-names");
  revalidatePath("/system/vendors");
  revalidatePath("/overview");
  revalidatePath("/printers");
  revalidatePath("/toner-monitoring");
  revalidatePath("/toner-expenses");
  revalidatePath("/contracts");
  revalidatePath("/repair-history");
  revalidatePath("/register");
  revalidatePath("/manage");
  revalidatePath("/portal");
}

// ---------- OFFICES ----------
export async function addLocationAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  const address = str(formData.get("address"));
  if (name) {
    const inserted = await db.insert(locations).values({ name, address }).onConflictDoNothing().returning({ id: locations.id });
    if (!inserted[0]) redirect("/system/organization?tab=offices&error=An office with that name already exists.");
  }
  revalidateAll();
  redirect("/system/organization?tab=offices&success=Office added.");
}
export async function updateLocationAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const name = str(formData.get("name"));
  const address = str(formData.get("address"));
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  if (id && name) {
    try {
      await db.update(locations).set({ name, address, status, updatedAt: new Date() }).where(eq(locations.id, id));
    } catch {
      redirect("/system/organization?tab=offices&error=An office with that name already exists.");
    }
  }
  revalidateAll();
  redirect("/system/organization?tab=offices&success=Office updated.");
}
export async function deleteLocationAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) {
    const result = await db.execute<{ count: number }>(sql`
      select (
        (select count(*) from ${users} where ${users.primaryLocationId} = ${id}) +
        (select count(*) from ${printers} where ${printers.locationId} = ${id}) +
        (select count(*) from ${repairTickets} where ${repairTickets.locationId} = ${id}) +
        (select count(*) from ${tonerTransactions} where ${tonerTransactions.locationId} = ${id}) +
        (select count(*) from ${userRegistrationRequests} where ${userRegistrationRequests.primaryLocationId} = ${id}) +
        (select count(*) from ${monitoringAgents} where ${monitoringAgents.locationId} = ${id}) +
        (select count(*) from ${organizationMappings} where ${organizationMappings.locationId} = ${id})
      )::int as count
    `);
    const count = result.rows[0]?.count ?? 0;
    if (count > 0) redirect(`/system/organization?tab=offices&error=${encodeURIComponent(`This office is referenced by ${count} record(s). Deactivate it instead.`)}`);
    await db.delete(locations).where(eq(locations.id, id));
  }
  revalidateAll();
  redirect("/system/organization?tab=offices&success=Office deleted.");
}

// ---------- DEPARTMENTS ----------
export async function addDepartmentAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  if (name) {
    const inserted = await db.insert(departments).values({ name }).onConflictDoNothing().returning({ id: departments.id });
    if (!inserted[0]) redirect("/system/organization?tab=departments&error=A department with that name already exists.");
  }
  revalidateAll();
  redirect("/system/organization?tab=departments&success=Department added.");
}
export async function updateDepartmentAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const name = str(formData.get("name"));
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  if (id && name) {
    try {
      await db.update(departments).set({ name, status, updatedAt: new Date() }).where(eq(departments.id, id));
    } catch {
      redirect("/system/organization?tab=departments&error=A department with that name already exists.");
    }
  }
  revalidateAll();
  redirect("/system/organization?tab=departments&success=Department updated.");
}
export async function deleteDepartmentAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) {
    const result = await db.execute<{ count: number }>(sql`
      select (
        (select count(*) from ${users} where ${users.departmentId} = ${id}) +
        (select count(*) from ${printers} where ${printers.departmentId} = ${id}) +
        (select count(*) from ${repairTickets} where ${repairTickets.departmentId} = ${id}) +
        (select count(*) from ${tonerTransactions} where ${tonerTransactions.departmentId} = ${id}) +
        (select count(*) from ${userRegistrationRequests} where ${userRegistrationRequests.departmentId} = ${id}) +
        (select count(*) from ${subunits} where ${subunits.departmentId} = ${id})
      )::int as count
    `);
    const count = result.rows[0]?.count ?? 0;
    if (count > 0) redirect(`/system/organization?tab=departments&error=${encodeURIComponent(`This department is referenced by ${count} record(s). Deactivate it instead.`)}`);
    await db.delete(departments).where(eq(departments.id, id));
  }
  revalidateAll();
  redirect("/system/organization?tab=departments&success=Department deleted.");
}

// ---------- SUBUNITS ----------
export async function addSubunitAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  const departmentId = num(formData.get("departmentId"));
  if (name && departmentId) {
    const [department] = await db.select({ id: departments.id }).from(departments).where(and(eq(departments.id, departmentId), eq(departments.status, "active"))).limit(1);
    if (!department) redirect("/system/organization?tab=subunits&error=Select an active department.");
    const inserted = await db.insert(subunits).values({ name, departmentId }).onConflictDoNothing().returning({ id: subunits.id });
    if (!inserted[0]) redirect("/system/organization?tab=subunits&error=That subunit already exists in the selected department.");
  }
  revalidateAll();
  redirect("/system/organization?tab=subunits&success=Subunit added.");
}

export async function updateSubunitAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const name = str(formData.get("name"));
  const departmentId = num(formData.get("departmentId"));
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  if (id && name && departmentId) {
    try {
      await db.update(subunits).set({ name, departmentId, status, updatedAt: new Date() }).where(eq(subunits.id, id));
    } catch {
      redirect("/system/organization?tab=subunits&error=That subunit already exists in the selected department.");
    }
  }
  revalidateAll();
  redirect("/system/organization?tab=subunits&success=Subunit updated.");
}

export async function deleteSubunitAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) {
    const result = await db.execute<{ count: number }>(sql`
      select (
        (select count(*) from ${users} where ${users.subunitId} = ${id}) +
        (select count(*) from ${printers} where ${printers.subunitId} = ${id}) +
        (select count(*) from ${repairTickets} where ${repairTickets.subunitId} = ${id}) +
        (select count(*) from ${tonerTransactions} where ${tonerTransactions.subunitId} = ${id}) +
        (select count(*) from ${userRegistrationRequests} where ${userRegistrationRequests.subunitId} = ${id}) +
        (select count(*) from ${organizationMappings} where ${organizationMappings.subunitId} = ${id})
      )::int as count
    `);
    const count = result.rows[0]?.count ?? 0;
    if (count > 0) redirect(`/system/organization?tab=subunits&error=${encodeURIComponent(`This subunit is referenced by ${count} record(s). Deactivate it instead.`)}`);
    await db.delete(subunits).where(eq(subunits.id, id));
  }
  revalidateAll();
  redirect("/system/organization?tab=subunits&success=Subunit deleted.");
}

// ---------- COST CENTERS AND ORGANIZATIONAL MAPPINGS ----------
export async function addOrganizationMappingAction(formData: FormData) {
  await requireAdmin("system");
  const locationId = num(formData.get("locationId"));
  const subunitId = num(formData.get("subunitId"));
  const code = str(formData.get("costCenter"));
  if (locationId && subunitId && code) {
    const [validLocation, validSubunit] = await Promise.all([
      db.select({ id: locations.id }).from(locations).where(and(eq(locations.id, locationId), eq(locations.status, "active"))).limit(1),
      db.select({ id: subunits.id }).from(subunits).where(and(eq(subunits.id, subunitId), eq(subunits.status, "active"))).limit(1),
    ]);
    if (!validLocation[0] || !validSubunit[0]) {
      redirect("/system/organization?tab=cost-centers&error=Select an active office and subunit.");
    }
    await db.transaction(async (tx) => {
      const [existingCostCenter] = await tx
        .select({ id: costCenters.id })
        .from(costCenters)
        .where(sql`lower(${costCenters.code}) = lower(${code})`)
        .limit(1);
      const [costCenter] = existingCostCenter
        ? await tx.update(costCenters).set({ status: "active", updatedAt: new Date() }).where(eq(costCenters.id, existingCostCenter.id)).returning({ id: costCenters.id })
        : await tx.insert(costCenters).values({ code }).returning({ id: costCenters.id });
      await tx.insert(organizationMappings).values({
        locationId,
        subunitId,
        costCenterId: costCenter.id,
      }).onConflictDoNothing();
    });
  }
  revalidateAll();
  redirect("/system/organization?tab=cost-centers&success=Organizational mapping added.");
}

export async function updateOrganizationMappingAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  if (id) await db.update(organizationMappings).set({ status, updatedAt: new Date() }).where(eq(organizationMappings.id, id));
  revalidateAll();
  redirect("/system/organization?tab=cost-centers&success=Organizational mapping updated.");
}

export async function deleteOrganizationMappingAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) {
    const [mapping] = await db.select().from(organizationMappings).where(eq(organizationMappings.id, id)).limit(1);
    if (mapping) {
      const result = await db.execute<{ count: number }>(sql`
        select (
          (select count(*) from ${users} where ${users.primaryLocationId} = ${mapping.locationId} and ${users.subunitId} = ${mapping.subunitId} and ${users.costCenterId} = ${mapping.costCenterId}) +
          (select count(*) from ${printers} where ${printers.locationId} = ${mapping.locationId} and ${printers.subunitId} = ${mapping.subunitId} and ${printers.costCenterId} = ${mapping.costCenterId}) +
          (select count(*) from ${repairTickets} where ${repairTickets.locationId} = ${mapping.locationId} and ${repairTickets.subunitId} = ${mapping.subunitId} and ${repairTickets.costCenterId} = ${mapping.costCenterId}) +
          (select count(*) from ${tonerTransactions} where ${tonerTransactions.locationId} = ${mapping.locationId} and ${tonerTransactions.subunitId} = ${mapping.subunitId} and ${tonerTransactions.costCenterId} = ${mapping.costCenterId})
        )::int as count
      `);
      const count = result.rows[0]?.count ?? 0;
      if (count > 0) redirect(`/system/organization?tab=cost-centers&error=${encodeURIComponent(`This mapping is referenced by ${count} record(s). Deactivate it instead.`)}`);
      await db.delete(organizationMappings).where(eq(organizationMappings.id, id));
    }
  }
  revalidateAll();
  redirect("/system/organization?tab=cost-centers&success=Organizational mapping deleted.");
}

export async function updateCostCenterAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const code = str(formData.get("code"));
  const status = formData.get("status") === "inactive" ? "inactive" : "active";
  if (id && code) {
    try {
      await db.update(costCenters).set({ code, status, updatedAt: new Date() }).where(eq(costCenters.id, id));
    } catch {
      redirect("/system/organization?tab=cost-centers&error=A cost center with that code already exists.");
    }
  }
  revalidateAll();
  redirect("/system/organization?tab=cost-centers&success=Cost center updated.");
}

export async function deleteCostCenterAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) {
    const result = await db.execute<{ count: number }>(sql`
      select (
        (select count(*) from ${users} where ${users.costCenterId} = ${id}) +
        (select count(*) from ${printers} where ${printers.costCenterId} = ${id}) +
        (select count(*) from ${repairTickets} where ${repairTickets.costCenterId} = ${id}) +
        (select count(*) from ${tonerTransactions} where ${tonerTransactions.costCenterId} = ${id}) +
        (select count(*) from ${userRegistrationRequests} where ${userRegistrationRequests.costCenterId} = ${id}) +
        (select count(*) from ${organizationMappings} where ${organizationMappings.costCenterId} = ${id})
      )::int as count
    `);
    const count = result.rows[0]?.count ?? 0;
    if (count > 0) redirect(`/system/organization?tab=cost-centers&error=${encodeURIComponent(`This cost center is referenced by ${count} record(s). Deactivate it instead.`)}`);
    await db.delete(costCenters).where(eq(costCenters.id, id));
  }
  revalidateAll();
  redirect("/system/organization?tab=cost-centers&success=Cost center deleted.");
}

// ---------- ITS NAMES ----------
export async function addItsNameAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  if (name) await db.insert(itsNames).values({ name }).onConflictDoNothing();
  revalidateAll();
  redirect("/system/its-names?success=ITS Name added.");
}
export async function deleteItsNameAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) await db.delete(itsNames).where(eq(itsNames.id, id));
  revalidateAll();
  redirect("/system/its-names?success=ITS Name deleted.");
}

// ---------- TONER TYPES ----------
export async function addTonerTypeAction(formData: FormData) {
  await requireAdmin("system");
  const name = str(formData.get("name"));
  const unitCost = num(formData.get("unitCost")) ?? 0;
  if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > 9_999_999_999.99) {
    redirect("/system/toner-types?error=Enter a valid non-negative unit cost.");
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
  redirect("/system/toner-types?success=Toner Type added. Dashboard alert card created.");
}
export async function updateTonerTypeAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  const name = str(formData.get("name"));
  const unitCost = num(formData.get("unitCost")) ?? 0;
  if (!Number.isFinite(unitCost) || unitCost < 0 || unitCost > 9_999_999_999.99) {
    redirect("/system/toner-types?error=Enter a valid non-negative unit cost.");
  }
  if (id && name) {
    await db
      .update(tonerTypes)
      .set({ name, unitCost: unitCost.toFixed(2) })
      .where(eq(tonerTypes.id, id));
  }
  revalidateAll();
  redirect("/system/toner-types?success=Toner type and unit cost updated.");
}
export async function deleteTonerTypeAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) await db.delete(tonerTypes).where(eq(tonerTypes.id, id));
  revalidateAll();
  redirect("/system/toner-types?success=Toner Type deleted. Dashboard alert card removed.");
}
export async function updateThresholdAction(formData: FormData) {
  await requireModuleFullAccess("system");
  const id = num(formData.get("tonerTypeId"));
  const threshold = num(formData.get("threshold"));
  const criticalThreshold = num(formData.get("criticalThreshold"));
  if (id && threshold !== null && criticalThreshold !== null && criticalThreshold > threshold) {
    redirect("/system/toner-types?error=Critical threshold must not exceed the low threshold.");
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
  redirect("/system/toner-types?success=Inventory thresholds updated.");
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
  redirect("/system/toner-types?success=Alert card visibility updated.");
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
  redirect("/system/vendors?success=Vendor added.");
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
  redirect("/system/vendors?success=Vendor updated.");
}
export async function deleteVendorAction(formData: FormData) {
  await requireAdmin("system");
  const id = num(formData.get("id"));
  if (id) await db.delete(vendors).where(eq(vendors.id, id));
  revalidateAll();
  redirect("/system/vendors?success=Vendor deleted.");
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
    redirect(`/system/notifications?tab=reminders&error=Invalid email address: ${invalidEmails[0]}`);
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
  redirect("/system/notifications?tab=reminders&success=Settings saved.");
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
    redirect("/system/notifications?tab=email&error=Complete all required SMTP fields with valid values.");
  }
  if (testRecipient && !isValidEmail(testRecipient)) redirect("/system/notifications?tab=email&error=Test recipient must be a valid email.");
  if (username && !password && !existing?.smtpPasswordEncrypted) redirect("/system/notifications?tab=email&error=Enter the SMTP password.");
  if (!username && password) redirect("/system/notifications?tab=email&error=SMTP username is required when setting a password.");
  let encryptedPassword = existing?.smtpPasswordEncrypted ?? null;
  if (password) encryptedPassword = encryptSecret(password);
  if (!username) encryptedPassword = null;
  const values = { smtpEnabled: enabled, smtpHost: host, smtpPort: port, smtpSecurity: security, smtpUsername: username, smtpPasswordEncrypted: encryptedPassword, smtpFrom: from, smtpFromName: fromName, smtpTestRecipient: testRecipient, updatedAt: new Date(), updatedBy: admin.id };
  if (existing) await db.update(systemSettings).set(values).where(eq(systemSettings.id, existing.id));
  else await db.insert(systemSettings).values(values);
  await db.insert(auditLogs).values({ actorUserId: admin.id, action: "smtp.settings_changed", targetType: "system_settings", metadata: { enabled, host, port, security, passwordChanged: Boolean(password) } });
  revalidateAll();
  redirect("/system/notifications?tab=email&success=SMTP settings saved.");
}
