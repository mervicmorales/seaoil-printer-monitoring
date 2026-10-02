"use server";

import { db } from "@/db";
import { tonerInventory, tonerTransactions, tonerTypes } from "@/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { processTonerInventoryAlert } from "@/lib/inventory-alerts";
import { randomUUID } from "crypto";
import { validateOrganizationSelection } from "@/lib/organization";

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

export type TonerFormState = { error?: string; fieldErrors?: Record<string, string> };

class InsufficientTonerStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InsufficientTonerStockError";
  }
}

async function allTonerTypesAreVisible(tonerTypeIds: number[]) {
  const rows = await db
    .select({ id: tonerTypes.id })
    .from(tonerTypes)
    .where(
      and(
        inArray(tonerTypes.id, tonerTypeIds),
        eq(tonerTypes.showAlertCard, true),
      ),
    );
  return rows.length === tonerTypeIds.length;
}

export async function createDeliveryAction(_prev: TonerFormState, formData: FormData): Promise<TonerFormState> {
  await requireModuleFullAccess("toner_monitoring");

  const date = str(formData.get("date"));
  const quantity = num(formData.get("quantity"));
  const ticketReference = str(formData.get("ticketReference"));
  const tonerTypeIds = [...new Set(formData.getAll("tonerTypeIds").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  const locationId = num(formData.get("locationId"));
  const departmentId = num(formData.get("departmentId"));
  const subunitId = num(formData.get("subunitId"));
  const costCenterId = num(formData.get("costCenterId"));
  const itsNameId = num(formData.get("itsNameId"));

  const fieldErrors: Record<string, string> = {};
  if (!date) fieldErrors.date = "Date is required.";
  if (!Number.isSafeInteger(quantity) || quantity! <= 0) fieldErrors.quantity = "Quantity must be a positive whole number.";
  if (!tonerTypeIds.length) fieldErrors.tonerTypeIds = "Select at least one toner type.";
  Object.assign(fieldErrors, await validateOrganizationSelection(
    { locationId, departmentId, subunitId, costCenterId },
    { requireSubunitWhenAvailable: Boolean(departmentId) },
  ));
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (!(await allTonerTypesAreVisible(tonerTypeIds))) {
    return { fieldErrors: { tonerTypeIds: "One or more selected toner types are hidden. Refresh and select a visible toner type." } };
  }

  const groupId = randomUUID();
  const remarks = str(formData.get("remarks"));

  await db.transaction(async (tx) => {
    for (const tonerTypeId of [...tonerTypeIds].sort((a, b) => a - b)) {
      await tx.insert(tonerTransactions).values({
        groupId,
        type: "Delivery",
        date: date!,
        ticketReference,
        tonerTypeId,
        quantity: quantity!,
        locationId,
        departmentId,
        subunitId,
        costCenterId,
        itsNameId,
        remarks,
      });
      await tx.insert(tonerInventory).values({ tonerTypeId, stock: quantity! })
        .onConflictDoUpdate({
          target: tonerInventory.tonerTypeId,
          set: { stock: sql`${tonerInventory.stock} + ${quantity!}` },
        });
    }
  });
  await Promise.all(tonerTypeIds.map((tonerTypeId) => processTonerInventoryAlert(tonerTypeId)));

  revalidatePath("/toner-monitoring");
  revalidatePath("/overview");
  redirect("/toner-monitoring?success=Toner delivery recorded and inventory updated.");
}

export async function createRequestAction(_prev: TonerFormState, formData: FormData): Promise<TonerFormState> {
  await requireModuleFullAccess("toner_monitoring");

  const date = str(formData.get("date"));
  const quantity = num(formData.get("quantity"));
  const ticketReference = str(formData.get("ticketReference"));
  const tonerTypeIds = [...new Set(formData.getAll("tonerTypeIds").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  const locationId = num(formData.get("locationId"));
  const departmentId = num(formData.get("departmentId"));
  const subunitId = num(formData.get("subunitId"));
  const costCenterId = num(formData.get("costCenterId"));
  const itsNameId = num(formData.get("itsNameId"));

  const fieldErrors: Record<string, string> = {};
  if (!date) fieldErrors.date = "Date is required.";
  if (!Number.isSafeInteger(quantity) || quantity! <= 0) fieldErrors.quantity = "Quantity must be a positive whole number.";
  if (!tonerTypeIds.length) fieldErrors.tonerTypeIds = "Select at least one toner type.";
  if (!locationId) fieldErrors.locationId = "Office is required.";
  if (!departmentId) fieldErrors.departmentId = "Department is required.";
  if (!itsNameId) fieldErrors.itsNameId = "ITS Name is required.";
  Object.assign(fieldErrors, await validateOrganizationSelection(
    { locationId, departmentId, subunitId, costCenterId },
    { requireLocation: true, requireDepartment: true, requireSubunitWhenAvailable: true },
  ));
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (!(await allTonerTypesAreVisible(tonerTypeIds))) {
    return { fieldErrors: { tonerTypeIds: "One or more selected toner types are hidden. Refresh and select a visible toner type." } };
  }

  const groupId = randomUUID();
  const remarks = str(formData.get("remarks"));

  try {
    await db.transaction(async (tx) => {
      for (const tonerTypeId of [...tonerTypeIds].sort((a, b) => a - b)) {
        const result = await tx.execute<{ stock: number; name: string }>(sql`
          select ${tonerInventory.stock} as stock, ${tonerTypes.name} as name
          from ${tonerInventory}
          inner join ${tonerTypes} on ${tonerTypes.id} = ${tonerInventory.tonerTypeId}
          where ${tonerInventory.tonerTypeId} = ${tonerTypeId}
          for update
        `);
        const inventory = result.rows[0];
        if (!inventory || inventory.stock <= 0) {
          throw new InsufficientTonerStockError(`${inventory?.name ?? "Selected toner"} is out of stock. The request was not saved.`);
        }
        if (inventory.stock < quantity!) {
          throw new InsufficientTonerStockError(`${inventory.name} has only ${inventory.stock} unit(s) available. The request was not saved.`);
        }
        await tx.insert(tonerTransactions).values({
          groupId,
          type: "Request",
          date: date!,
          ticketReference,
          tonerTypeId,
          quantity: quantity!,
          locationId,
          departmentId,
          subunitId,
          costCenterId,
          itsNameId,
          remarks,
        });
        await tx.update(tonerInventory)
          .set({ stock: sql`${tonerInventory.stock} - ${quantity!}` })
          .where(eq(tonerInventory.tonerTypeId, tonerTypeId));
      }
    });
  } catch (error) {
    if (error instanceof InsufficientTonerStockError) return { error: error.message };
    throw error;
  }

  await Promise.all(tonerTypeIds.map((tonerTypeId) => processTonerInventoryAlert(tonerTypeId)));

  revalidatePath("/toner-monitoring");
  revalidatePath("/overview");
  redirect("/toner-monitoring?success=Toner request recorded and inventory updated.");
}

export async function updateTransactionAction(_prev: TonerFormState, formData: FormData): Promise<TonerFormState> {
  await requireModuleFullAccess("toner_monitoring");

  const id = num(formData.get("id"));
  if (!Number.isSafeInteger(id) || id! < 1) return { error: "Invalid transaction." };

  const date = str(formData.get("date"));
  const quantity = num(formData.get("quantity"));
  const tonerTypeId = num(formData.get("tonerTypeId"));
  const submittedType = str(formData.get("type"));
  const ticketReference = str(formData.get("ticketReference"));
  const organization = {
    locationId: num(formData.get("locationId")),
    departmentId: num(formData.get("departmentId")),
    subunitId: num(formData.get("subunitId")),
    costCenterId: num(formData.get("costCenterId")),
  };

  if (!date || !Number.isSafeInteger(quantity) || quantity! <= 0 || !Number.isSafeInteger(tonerTypeId) || tonerTypeId! < 1) {
    return { error: "Date, toner type and a positive whole-number quantity are required." };
  }
  if (submittedType && submittedType !== "Delivery" && submittedType !== "Request") {
    return { error: "Select a valid transaction type." };
  }
  const organizationErrors = await validateOrganizationSelection(organization, {
    requireLocation: submittedType === "Request",
    requireDepartment: submittedType === "Request",
    requireSubunitWhenAvailable: Boolean(organization.departmentId),
    requireActive: false,
  });
  if (Object.keys(organizationErrors).length) return { fieldErrors: organizationErrors };

  let affectedTypes: number[] = [];
  try {
    affectedTypes = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(tonerTransactions)
        .where(eq(tonerTransactions.id, id!)).for("update");
      if (!existing) throw new Error("TransactionNotFound");
      const type = submittedType || existing.type;
      if (type !== "Delivery" && type !== "Request") throw new Error("InvalidTransactionType");
      const deltas = new Map<number, number>();
      deltas.set(existing.tonerTypeId, existing.type === "Delivery" ? -existing.quantity : existing.quantity);
      deltas.set(tonerTypeId!, (deltas.get(tonerTypeId!) ?? 0) + (type === "Delivery" ? quantity! : -quantity!));
      const ids = [...deltas.keys()].sort((a, b) => a - b);
      for (const typeId of ids) {
        await tx.insert(tonerInventory).values({ tonerTypeId: typeId, stock: 0 })
          .onConflictDoNothing({ target: tonerInventory.tonerTypeId });
        const [inventory] = await tx.select({ stock: tonerInventory.stock }).from(tonerInventory)
          .where(eq(tonerInventory.tonerTypeId, typeId)).for("update");
        const delta = deltas.get(typeId)!;
        if (!inventory || inventory.stock + delta < 0) {
          throw new InsufficientTonerStockError("This change would make toner stock negative. Adjust related transactions first.");
        }
        await tx.update(tonerInventory).set({ stock: sql`${tonerInventory.stock} + ${delta}` })
          .where(eq(tonerInventory.tonerTypeId, typeId));
      }
      await tx.update(tonerTransactions).set({
        date,
        quantity: quantity!,
        tonerTypeId: tonerTypeId!,
        type,
        ticketReference,
        ...organization,
        itsNameId: num(formData.get("itsNameId")),
        remarks: str(formData.get("remarks")),
      }).where(eq(tonerTransactions.id, id!));
      return ids;
    });
  } catch (error) {
    if (error instanceof InsufficientTonerStockError) return { error: error.message };
    if (error instanceof Error && error.message === "TransactionNotFound") return { error: "Transaction not found." };
    return { error: "Could not update the transaction." };
  }

  await Promise.all(affectedTypes.map((typeId) => processTonerInventoryAlert(typeId)));

  revalidatePath("/toner-monitoring");
  revalidatePath("/overview");
  redirect("/toner-monitoring?success=Transaction updated successfully.");
}

export async function deleteTransactionAction(formData: FormData) {
  await requireModuleFullAccess("toner_monitoring");
  const id = num(formData.get("id"));
  if (!Number.isSafeInteger(id) || id! < 1) return;
  let affectedType: number | null = null;
  try {
    affectedType = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(tonerTransactions)
        .where(eq(tonerTransactions.id, id!)).for("update");
      if (!existing) return null;
      const [inventory] = await tx.select({ stock: tonerInventory.stock }).from(tonerInventory)
        .where(eq(tonerInventory.tonerTypeId, existing.tonerTypeId)).for("update");
      const reverseDelta = existing.type === "Delivery" ? -existing.quantity : existing.quantity;
      if (!inventory || inventory.stock + reverseDelta < 0) {
        throw new InsufficientTonerStockError("This delivery cannot be deleted because its stock has already been used.");
      }
      await tx.update(tonerInventory).set({ stock: sql`${tonerInventory.stock} + ${reverseDelta}` })
        .where(eq(tonerInventory.tonerTypeId, existing.tonerTypeId));
      await tx.delete(tonerTransactions).where(eq(tonerTransactions.id, id!));
      return existing.tonerTypeId;
    });
  } catch (error) {
    if (error instanceof InsufficientTonerStockError) {
      redirect(`/toner-monitoring?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  if (affectedType) await processTonerInventoryAlert(affectedType);
  revalidatePath("/toner-monitoring");
  revalidatePath("/overview");
  redirect("/toner-monitoring?success=Transaction deleted.");
}
