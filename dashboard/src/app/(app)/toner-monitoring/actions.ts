"use server";

import { db } from "@/db";
import { tonerInventory, tonerTransactions } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleFullAccess, checkLowStockAndNotify } from "@/lib/server-utils";
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
  const tonerTypeIds = formData.getAll("tonerTypeIds").map((v) => Number(v)).filter((n) => !Number.isNaN(n));

  const fieldErrors: Record<string, string> = {};
  if (!date) fieldErrors.date = "Date is required.";
  if (!quantity || quantity <= 0) fieldErrors.quantity = "Quantity must be greater than zero.";
  if (!tonerTypeIds.length) fieldErrors.tonerTypeIds = "Select at least one toner type.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const groupId = randomUUID();
  const locationId = num(formData.get("locationId"));
  const departmentId = num(formData.get("departmentId"));
  const itsNameId = num(formData.get("itsNameId"));
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
  const tonerTypeIds = formData.getAll("tonerTypeIds").map((v) => Number(v)).filter((n) => !Number.isNaN(n));

  const fieldErrors: Record<string, string> = {};
  if (!date) fieldErrors.date = "Date is required.";
  if (!quantity || quantity <= 0) fieldErrors.quantity = "Quantity must be greater than zero.";
  if (!tonerTypeIds.length) fieldErrors.tonerTypeIds = "Select at least one toner type.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const groupId = randomUUID();
  const locationId = num(formData.get("locationId"));
  const departmentId = num(formData.get("departmentId"));
  const itsNameId = num(formData.get("itsNameId"));
  const remarks = str(formData.get("remarks"));

  for (const tonerTypeId of tonerTypeIds) {
    await db.insert(tonerTransactions).values({
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
    await adjustStock(tonerTypeId, -quantity!);
    await checkLowStockAndNotify(tonerTypeId);
  }

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

  if (type === "Request") await checkLowStockAndNotify(tonerTypeId);

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
  }
  revalidatePath("/toner-monitoring");
  revalidatePath("/dashboard");
  redirect("/toner-monitoring?success=Transaction deleted.");
}
