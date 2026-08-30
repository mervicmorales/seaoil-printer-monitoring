"use server";

import { db } from "@/db";
import { tonerInventory, tonerTransactions, tonerTypes } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { processTonerInventoryAlert } from "@/lib/inventory-alerts";
import { randomUUID } from "crypto";

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

async function adjustStock(tonerTypeId: number, delta: number) {
  const rows = await db.select().from(tonerInventory).where(eq(tonerInventory.tonerTypeId, tonerTypeId)).limit(1);
  if (!rows.length) {
    await db.insert(tonerInventory).values({ tonerTypeId, stock: Math.max(delta, 0), lowStockThreshold: 5 });
    return;
  }
  const newStock = Math.max(0, rows[0].stock + delta);
  await db.update(tonerInventory).set({ stock: newStock }).where(eq(tonerInventory.tonerTypeId, tonerTypeId));
}

export async function createDeliveryAction(_prev: TonerFormState, formData: FormData): Promise<TonerFormState> {
  await requireModuleFullAccess("toner");

  const date = str(formData.get("date"));
  const quantity = num(formData.get("quantity"));
  const ticketReference = str(formData.get("ticketReference"));
  const tonerTypeIds = [...new Set(formData.getAll("tonerTypeIds").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  const locationId = num(formData.get("locationId"));
  const departmentId = num(formData.get("departmentId"));
  const itsNameId = num(formData.get("itsNameId"));

  const fieldErrors: Record<string, string> = {};
  if (!date) fieldErrors.date = "Date is required.";
  if (!quantity || quantity <= 0) fieldErrors.quantity = "Quantity must be greater than zero.";
  if (!tonerTypeIds.length) fieldErrors.tonerTypeIds = "Select at least one toner type.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const groupId = randomUUID();
  const remarks = str(formData.get("remarks"));

  for (const tonerTypeId of tonerTypeIds) {
    await db.insert(tonerTransactions).values({
      groupId,
      type: "Delivery",
      date: date!,
      ticketReference,
      tonerTypeId,
      quantity: quantity!,
      locationId,
      departmentId,
      itsNameId,
      remarks,
    });
    await adjustStock(tonerTypeId, quantity!);
    await processTonerInventoryAlert(tonerTypeId);
  }

  revalidatePath("/toner-monitoring");
  revalidatePath("/dashboard");
  redirect("/toner-monitoring?success=Toner delivery recorded and inventory updated.");
}

export async function createRequestAction(_prev: TonerFormState, formData: FormData): Promise<TonerFormState> {
  await requireModuleFullAccess("toner");

  const date = str(formData.get("date"));
  const quantity = num(formData.get("quantity"));
  const ticketReference = str(formData.get("ticketReference"));
  const tonerTypeIds = [...new Set(formData.getAll("tonerTypeIds").map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  const locationId = num(formData.get("locationId"));
  const departmentId = num(formData.get("departmentId"));
  const itsNameId = num(formData.get("itsNameId"));

  const fieldErrors: Record<string, string> = {};
  if (!date) fieldErrors.date = "Date is required.";
  if (!quantity || quantity <= 0) fieldErrors.quantity = "Quantity must be greater than zero.";
  if (!tonerTypeIds.length) fieldErrors.tonerTypeIds = "Select at least one toner type.";
  if (!locationId) fieldErrors.locationId = "Location is required.";
  if (!departmentId) fieldErrors.departmentId = "Department is required.";
  if (!itsNameId) fieldErrors.itsNameId = "ITS Name is required.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const groupId = randomUUID();
  const remarks = str(formData.get("remarks"));

  try {
    await db.transaction(async (tx) => {
      for (const tonerTypeId of tonerTypeIds) {
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
  revalidatePath("/dashboard");
  redirect("/toner-monitoring?success=Toner request recorded and inventory updated.");
}

export async function updateTransactionAction(_prev: TonerFormState, formData: FormData): Promise<TonerFormState> {
  await requireModuleFullAccess("toner");

  const id = num(formData.get("id"));
  if (!id) return { error: "Invalid transaction." };

  const existingRows = await db.select().from(tonerTransactions).where(eq(tonerTransactions.id, id)).limit(1);
  const existing = existingRows[0];
  if (!existing) return { error: "Transaction not found." };

  const date = str(formData.get("date"));
  const quantity = num(formData.get("quantity"));
  const tonerTypeId = num(formData.get("tonerTypeId"));
  const type = str(formData.get("type")) || existing.type;
  const ticketReference = str(formData.get("ticketReference"));

  if (!date || !quantity || quantity <= 0 || !tonerTypeId) {
    return { error: "Date, toner type and a positive quantity are required." };
  }

  if (type === "Request") {
    const [targetInventory] = await db
      .select({ stock: tonerInventory.stock })
      .from(tonerInventory)
      .where(eq(tonerInventory.tonerTypeId, tonerTypeId))
      .limit(1);
    let stockAfterReversal = targetInventory?.stock ?? 0;
    if (existing.tonerTypeId === tonerTypeId) {
      stockAfterReversal = existing.type === "Request"
        ? stockAfterReversal + existing.quantity
        : Math.max(0, stockAfterReversal - existing.quantity);
    }
    if (stockAfterReversal <= 0) {
      return { error: "The selected toner is out of stock. The request was not saved." };
    }
    if (stockAfterReversal < quantity) {
      return { error: `Only ${stockAfterReversal} unit(s) are available. The request was not saved.` };
    }
  }

  // reverse old effect
  const oldDelta = existing.type === "Delivery" ? -existing.quantity : existing.quantity;
  await adjustStock(existing.tonerTypeId, oldDelta);
  // apply new effect
  const newDelta = type === "Delivery" ? quantity : -quantity;
  await adjustStock(tonerTypeId, newDelta);

  await db
    .update(tonerTransactions)
    .set({
      date,
      quantity,
      tonerTypeId,
      type,
      ticketReference,
      locationId: num(formData.get("locationId")),
      departmentId: num(formData.get("departmentId")),
      itsNameId: num(formData.get("itsNameId")),
      remarks: str(formData.get("remarks")),
    })
    .where(eq(tonerTransactions.id, id));

  await processTonerInventoryAlert(existing.tonerTypeId);
  if (tonerTypeId !== existing.tonerTypeId) await processTonerInventoryAlert(tonerTypeId);

  revalidatePath("/toner-monitoring");
  revalidatePath("/dashboard");
  redirect("/toner-monitoring?success=Transaction updated successfully.");
}

export async function deleteTransactionAction(formData: FormData) {
  await requireModuleFullAccess("toner");
  const id = num(formData.get("id"));
  if (!id) return;
  const rows = await db.select().from(tonerTransactions).where(eq(tonerTransactions.id, id)).limit(1);
  const existing = rows[0];
  if (existing) {
    const reverseDelta = existing.type === "Delivery" ? -existing.quantity : existing.quantity;
    await adjustStock(existing.tonerTypeId, reverseDelta);
    await db.delete(tonerTransactions).where(eq(tonerTransactions.id, id));
    await processTonerInventoryAlert(existing.tonerTypeId);
  }
  revalidatePath("/toner-monitoring");
  revalidatePath("/dashboard");
  redirect("/toner-monitoring?success=Transaction deleted.");
}
