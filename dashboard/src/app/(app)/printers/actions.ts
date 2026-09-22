"use server";

import { db } from "@/db";
import {
  contracts,
  monitoringAgents,
  printerMonitoringAssignments,
  printers,
  printerTonerTypes,
  replacementHistory,
} from "@/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { isIP } from "net";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireModuleFullAccess } from "@/lib/server-utils";
import { PRINTER_STATUSES } from "@/lib/constants";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";
import { normalizeMacAddress } from "@/lib/mac-address";
import { hasAdminPrivileges } from "@/lib/roles";

function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}

export type PrinterFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function updatePrinterStatusAction(
  printerId: number,
  status: string,
): Promise<{ success: boolean }> {
  await requireAdmin("printer_records");

  if (!Number.isInteger(printerId) || !PRINTER_STATUSES.some((item) => item === status)) {
    return { success: false };
  }

  const updated = await db
    .update(printers)
    .set({ status, updatedAt: new Date() })
    .where(eq(printers.id, printerId))
    .returning({ id: printers.id });

  if (!updated.length) return { success: false };

  revalidatePath("/printers");
  revalidatePath(`/printers/${printerId}`);
  revalidatePath("/overview");
  revalidatePath("/printdash");
  return { success: true };
}

async function validateMonitoringAssignment(
  formData: FormData,
  fieldErrors: Record<string, string>,
  options: { allowTextAddress?: boolean; maxAddressLength?: number } = {},
) {
  const enabled = formData.get("monitoringEnabled") === "on";
  const ipAddress = str(formData.get("ipAddress"));
  const rawMacAddress = str(formData.get("macAddress"));
  const macAddress = normalizeMacAddress(rawMacAddress);
  if (rawMacAddress && !macAddress) {
    fieldErrors.macAddress = "Enter a valid MAC address, such as 00:1A:2B:3C:4D:5E.";
  }
  const agentId = num(formData.get("monitoringAgentId"));

  if (
    ipAddress &&
    options.maxAddressLength !== undefined &&
    ipAddress.length > options.maxAddressLength
  ) {
    fieldErrors.ipAddress = `IP Address must not exceed ${options.maxAddressLength} characters.`;
  } else if (ipAddress && !options.allowTextAddress && isIP(ipAddress) === 0) {
    fieldErrors.ipAddress = "Enter a valid IPv4 or IPv6 address.";
  }

  if (!enabled) return { enabled, agentId: null, ipAddress, macAddress };

  if (!ipAddress) {
    fieldErrors.ipAddress = "IP Address is required when monitoring is enabled.";
  }
  if (!agentId) {
    fieldErrors.monitoringAgentId = "Select a monitoring agent.";
  } else {
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
    if (!agent) {
      fieldErrors.monitoringAgentId =
        "Select an agent with an active credential.";
    }
  }

  return { enabled, agentId, ipAddress, macAddress };
}

export async function createPrinterAction(
  _prev: PrinterFormState,
  formData: FormData,
): Promise<PrinterFormState> {
  await requireModuleFullAccess("printer_records");

  const serialNumber = str(formData.get("serialNumber"));
  const model = str(formData.get("model"));
  const status = str(formData.get("status")) || "Active";
  const returnTo = normalizePrinterReturnTo(str(formData.get("returnTo")));

  const fieldErrors: Record<string, string> = {};
  if (!serialNumber) fieldErrors.serialNumber = "Serial Number is required.";
  if (!model) fieldErrors.model = "Model is required.";
  const monitoring = await validateMonitoringAssignment(formData, fieldErrors, {
    allowTextAddress: true,
    maxAddressLength: 20,
  });
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const contractId = num(formData.get("contractId"));
  const tonerTypeIds = formData.getAll("tonerTypeIds").map((v) => Number(v)).filter((n) => !Number.isNaN(n));

  try {
    await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(printers)
        .values({
          assetTag: str(formData.get("assetTag")),
          ipAddress: monitoring.ipAddress,
          macAddress: monitoring.macAddress,
          serialNumber: serialNumber!,
          model,
          monthlyRate: String(num(formData.get("monthlyRate")) ?? 0),
          locationId: num(formData.get("locationId")),
          departmentId: num(formData.get("departmentId")),
          vendorId: num(formData.get("vendorId")),
          contractId,
          assignedUser: str(formData.get("assignedUser")),
          status,
        })
        .returning({ id: printers.id });

      if (tonerTypeIds.length) {
        await tx
          .insert(printerTonerTypes)
          .values(tonerTypeIds.map((tonerTypeId) => ({ printerId: inserted.id, tonerTypeId })));
      }
      if (monitoring.enabled && monitoring.agentId) {
        await tx.insert(printerMonitoringAssignments).values({
          printerId: inserted.id,
          agentId: monitoring.agentId,
        });
      }
    });
  } catch (err) {
    console.error(err);
    return { error: "Could not save printer. Serial number may already exist." };
  }

  revalidatePath("/printers");
  revalidatePath("/overview");
  revalidatePath("/printdash");
  redirect(`${returnTo}?success=${encodeURIComponent("Printer added successfully.")}`);
}

export async function updatePrinterAction(
  _prev: PrinterFormState,
  formData: FormData,
): Promise<PrinterFormState> {
  const session = await requireModuleFullAccess("printer_records");

  const id = num(formData.get("id"));
  if (!id) return { error: "Invalid printer." };
  const returnTo = normalizePrinterReturnTo(str(formData.get("returnTo")));

  const tonerTypeIds = formData.getAll("tonerTypeIds").map((v) => Number(v)).filter((n) => !Number.isNaN(n));
  const newSerialNumber = str(formData.get("newSerialNumber"));
  const replacementDate = str(formData.get("replacementDate"));
  const replacementModel = str(formData.get("replacementModel"));
  const fieldErrors: Record<string, string> = {};
  const monitoring = await validateMonitoringAssignment(formData, fieldErrors, {
    allowTextAddress: true,
    maxAddressLength: 20,
  });
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  if (newSerialNumber && !hasAdminPrivileges(session.role)) {
    return { error: "Only administrators can record printer replacements." };
  }
  if (newSerialNumber && !replacementDate) {
    return { error: "Select a replacement date before saving the new serial number." };
  }

  const [replacementSource] = newSerialNumber
    ? await db
        .select({ serialNumber: printers.serialNumber, model: printers.model })
        .from(printers)
        .where(eq(printers.id, id))
        .limit(1)
    : [];
  if (newSerialNumber && !replacementSource) return { error: "Printer not found." };
  if (newSerialNumber && newSerialNumber === replacementSource?.serialNumber) {
    return { error: "Enter a different serial number for the replacement unit." };
  }

  try {
    await db.transaction(async (tx) => {
      if (session.role === "support") {
        await tx
          .update(printers)
          .set({ ipAddress: monitoring.ipAddress, macAddress: monitoring.macAddress, updatedAt: new Date() })
          .where(eq(printers.id, id));
      } else {
        await tx
          .update(printers)
          .set({
            assetTag: str(formData.get("assetTag")),
            ipAddress: monitoring.ipAddress,
            macAddress: monitoring.macAddress,
            monthlyRate: String(num(formData.get("monthlyRate")) ?? 0),
            locationId: num(formData.get("locationId")),
            departmentId: num(formData.get("departmentId")),
            vendorId: num(formData.get("vendorId")),
            contractId: num(formData.get("contractId")),
            assignedUser: str(formData.get("assignedUser")),
            status: str(formData.get("status")) || "Active",
            updatedAt: new Date(),
          })
          .where(eq(printers.id, id));

        await tx.delete(printerTonerTypes).where(eq(printerTonerTypes.printerId, id));
        if (tonerTypeIds.length) {
          await tx
            .insert(printerTonerTypes)
            .values(tonerTypeIds.map((tonerTypeId) => ({ printerId: id, tonerTypeId })));
        }

        if (newSerialNumber && replacementDate && replacementSource) {
          const nextModel = replacementModel || replacementSource.model;
          await tx.insert(replacementHistory).values({
            printerId: id,
            replacementDate,
            oldSerialNumber: replacementSource.serialNumber,
            newSerialNumber,
            model: nextModel,
          });
          await tx
            .update(printers)
            .set({
              serialNumber: newSerialNumber,
              model: nextModel,
              macAddress: null,
              updatedAt: new Date(),
            })
            .where(eq(printers.id, id));
        }
      }

      if (monitoring.enabled && monitoring.agentId) {
        await tx
          .insert(printerMonitoringAssignments)
          .values({ printerId: id, agentId: monitoring.agentId })
          .onConflictDoUpdate({
            target: printerMonitoringAssignments.printerId,
            set: { agentId: monitoring.agentId, updatedAt: new Date() },
          });
      } else {
        await tx
          .delete(printerMonitoringAssignments)
          .where(eq(printerMonitoringAssignments.printerId, id));
      }
    });
  } catch (err) {
    console.error(err);
    return { error: "Could not update printer." };
  }

  revalidatePath("/printers");
  revalidatePath(`/printers/${id}`);
  revalidatePath(`/printers/${id}/edit`);
  revalidatePath("/overview");
  revalidatePath("/printdash");
  redirect(
    `/printers/${id}?success=${encodeURIComponent(newSerialNumber ? "Printer updated and replacement recorded successfully." : "Printer updated successfully.")}&returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export async function deletePrinterAction(formData: FormData) {
  await requireAdmin("printer_records");
  const id = num(formData.get("id"));
  if (!id) return;
  await db.delete(printers).where(eq(printers.id, id));
  revalidatePath("/printers");
  revalidatePath("/overview");
  redirect("/printers?success=Printer deleted.");
}

export async function addReplacementAction(
  _prev: PrinterFormState,
  formData: FormData,
): Promise<PrinterFormState> {
  await requireAdmin("printer_records");

  const printerId = num(formData.get("printerId"));
  const newSerialNumber = str(formData.get("newSerialNumber"));
  const replacementDate = str(formData.get("replacementDate"));
  const returnTo = normalizePrinterReturnTo(str(formData.get("returnTo")));
  if (!printerId || !newSerialNumber || !replacementDate) {
    return { error: "Replacement date and new serial number are required." };
  }

  const rows = await db.select().from(printers).where(eq(printers.id, printerId)).limit(1);
  const printer = rows[0];
  if (!printer) return { error: "Printer not found." };

  const model = str(formData.get("model")) || printer.model;

  try {
    await db.insert(replacementHistory).values({
      printerId,
      replacementDate,
      oldSerialNumber: printer.serialNumber,
      newSerialNumber,
      model,
    });

    await db
      .update(printers)
      .set({ serialNumber: newSerialNumber, model, macAddress: null, updatedAt: new Date() })
      .where(eq(printers.id, printerId));
  } catch (err) {
    console.error(err);
    return { error: "Could not save replacement. New serial number may already be in use." };
  }

  revalidatePath(`/printers/${printerId}`);
  revalidatePath(`/printers/${printerId}/edit`);
  revalidatePath("/printers");
  redirect(
    `/printers/${printerId}?success=${encodeURIComponent("Replacement recorded successfully.")}&returnTo=${encodeURIComponent(returnTo)}`,
  );
}

export async function getContractEndDate(contractId: number) {
  const rows = await db.select().from(contracts).where(eq(contracts.id, contractId)).limit(1);
  return rows[0]?.endDate ?? null;
}
