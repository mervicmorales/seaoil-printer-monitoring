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
import { archiveStoredUpload, privateUploadPath, storedUploadUrl } from "@/lib/private-uploads";

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
  if (file.size > 10 * 1024 * 1024) throw new Error("DocumentTooLarge");
  const ext = path.extname(file.name).toLowerCase();
  if (![".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx"].includes(ext)) {
    throw new Error("UnsupportedDocument");
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const matchesType = ext === ".pdf" ? buffer.subarray(0, 5).toString() === "%PDF-"
    : ext === ".png" ? buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
    : ext === ".jpg" || ext === ".jpeg" ? buffer.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
    : ext === ".webp" ? buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP"
    : buffer.subarray(0, 4).equals(Buffer.from("504b0304", "hex"));
  if (!matchesType) throw new Error("DocumentTypeMismatch");
  const filename = `${randomUUID()}${ext}`;
  const destination = privateUploadPath("contracts", filename);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, buffer, { flag: "wx", mode: 0o600 });
  return { url: storedUploadUrl("contracts", filename), name: file.name };
}

export type ContractFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  await requireAdmin("contract");

  const contractNumber = str(formData.get("contractNumber"));
  const fieldErrors: Record<string, string> = {};
  if (!contractNumber) fieldErrors.contractNumber = "Contract Number is required.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  let doc: Awaited<ReturnType<typeof saveDocument>> = null;
  try {
    doc = await saveDocument(formData.get("document") as File | null);
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
    if (doc) await archiveStoredUpload("contracts", doc.url);
    return { error: "Could not save contract. Check the contract number and upload a PDF, PNG, JPEG, WebP, or DOCX file up to 10 MB." };
  }

  revalidatePath("/contracts");
  redirect("/contracts?success=Contract uploaded successfully.");
}

export async function updateContractAction(_prev: ContractFormState, formData: FormData): Promise<ContractFormState> {
  await requireAdmin("contract");
  const id = num(formData.get("id"));
  if (!id) return { error: "Invalid contract." };

  const [existing] = await db.select({ documentUrl: contracts.documentUrl }).from(contracts).where(eq(contracts.id, id)).limit(1);
  if (!existing) return { error: "Contract not found." };
  let doc: Awaited<ReturnType<typeof saveDocument>> = null;
  try {
    doc = await saveDocument(formData.get("document") as File | null);
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
    if (doc) await archiveStoredUpload("contracts", doc.url);
    return { error: "Could not update contract." };
  }

  if (doc && existing.documentUrl) {
    await archiveStoredUpload("contracts", existing.documentUrl);
  }

  revalidatePath("/contracts");
  redirect("/contracts?success=Contract updated successfully.");
}

export async function deleteContractAction(formData: FormData) {
  await requireAdmin("contract");
  const id = num(formData.get("id"));
  if (!id) return;
  const [existing] = await db.select({ documentUrl: contracts.documentUrl }).from(contracts).where(eq(contracts.id, id)).limit(1);
  await db.delete(contracts).where(eq(contracts.id, id));
  if (existing?.documentUrl) await archiveStoredUpload("contracts", existing.documentUrl);
  revalidatePath("/contracts");
  redirect("/contracts?success=Contract deleted.");
}
