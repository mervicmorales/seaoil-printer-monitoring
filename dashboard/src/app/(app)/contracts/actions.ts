"use server";

import { db } from "@/db";
import { contracts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server-utils";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
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

async function saveDocument(file: File | null) {
  if (!file || file.size === 0) return null;
  const uploadDir = path.join(process.cwd(), "public", "uploads", "contracts");
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(file.name) || "";
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(uploadDir, filename), buffer);
  return { url: `/uploads/contracts/${filename}`, name: file.name };
}

export type ContractFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  await requireAdmin("contract");

  const contractNumber = str(formData.get("contractNumber"));
  const fieldErrors: Record<string, string> = {};
  if (!contractNumber) fieldErrors.contractNumber = "Contract Number is required.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const doc = await saveDocument(formData.get("document") as File | null);
    await db.insert(contracts).values({
      contractNumber: contractNumber!,
      vendorId: num(formData.get("vendorId")),
      startDate: str(formData.get("startDate")),
      endDate: str(formData.get("endDate")),
      documentUrl: doc?.url ?? null,
      documentName: doc?.name ?? null,
      notes: str(formData.get("notes")),
    });
  } catch (err) {
    console.error(err);
    return { error: "Could not save contract. The contract number may already exist." };
  }

  revalidatePath("/contracts");
  redirect("/contracts?success=Contract uploaded successfully.");
}

export async function updateContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  await requireAdmin("contract");
  const id = num(formData.get("id"));
  if (!id) return { error: "Invalid contract." };

  try {
    const doc = await saveDocument(formData.get("document") as File | null);
    const updateValues: Record<string, unknown> = {
      vendorId: num(formData.get("vendorId")),
      startDate: str(formData.get("startDate")),
      endDate: str(formData.get("endDate")),
      notes: str(formData.get("notes")),
    };
    if (doc) {
      updateValues.documentUrl = doc.url;
      updateValues.documentName = doc.name;
    }
    await db.update(contracts).set(updateValues).where(eq(contracts.id, id));
  } catch (err) {
    console.error(err);
    return { error: "Could not update contract." };
  }

  revalidatePath("/contracts");
  redirect("/contracts?success=Contract updated successfully.");
}

export async function deleteContractAction(formData: FormData) {
  await requireAdmin("contract");
  const id = num(formData.get("id"));
  if (!id) return;
  await db.delete(contracts).where(eq(contracts.id, id));
  revalidatePath("/contracts");
  redirect("/contracts?success=Contract deleted.");
}
