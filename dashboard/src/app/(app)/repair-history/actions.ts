"use server";

import { db } from "@/db";
import { printers, repairTickets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleFullAccess, requireSession, generateTicketNumber, createNotification } from "@/lib/server-utils";
import { REPAIR_STATUSES } from "@/lib/constants";
import { mkdir, unlink, writeFile } from "fs/promises";
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

const RESOLUTION_ATTACHMENT_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_RESOLUTION_ATTACHMENT_BYTES = 5 * 1024 * 1024;

async function saveResolutionAttachment(file: File | null) {
  if (!file || file.size === 0) return null;
  const extension = RESOLUTION_ATTACHMENT_TYPES[file.type];
  if (!extension) throw new Error("UnsupportedResolutionAttachment");
  if (file.size > MAX_RESOLUTION_ATTACHMENT_BYTES) {
    throw new Error("ResolutionAttachmentTooLarge");
  }

  const uploadDir = path.join(process.cwd(), "public", "uploads", "repair-resolutions");
  await mkdir(uploadDir, { recursive: true });
  const filename = `${randomUUID()}${extension}`;
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
  return { url: `/uploads/repair-resolutions/${filename}`, name: file.name };
}

async function deleteResolutionAttachment(url: string | null) {
  const prefix = "/uploads/repair-resolutions/";
  if (!url?.startsWith(prefix)) return;

  const filename = path.basename(url);
  if (!filename || url !== `${prefix}${filename}`) return;

  try {
    await unlink(path.join(process.cwd(), "public", "uploads", "repair-resolutions", filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error("Could not remove a repair resolution attachment.");
    }
  }
}

export type RepairFormState = {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
};

export async function updateTicketDetailsAction(
  _prev: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  await requireModuleFullAccess("repair");

  const id = num(formData.get("id"));
  const status = str(formData.get("status"));
  const problem = str(formData.get("problem"));
  const resolution = str(formData.get("resolution"));
  if (!id) return { error: "Invalid ticket." };

  const fieldErrors: Record<string, string> = {};
  if (!status || !REPAIR_STATUSES.some((item) => item === status)) {
    fieldErrors.status = "Select a valid status.";
  }
  if (!problem) fieldErrors.problem = "Concern description is required.";
  if (status === "Closed" && !resolution) {
    fieldErrors.resolution = "Resolution is required when closing a ticket.";
  }
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const [existing] = await db
    .select({
      dateClosed: repairTickets.dateClosed,
      resolutionAttachmentUrl: repairTickets.resolutionAttachmentUrl,
    })
    .from(repairTickets)
    .where(eq(repairTickets.id, id))
    .limit(1);
  if (!existing) return { error: "Repair ticket not found." };

  let attachment: Awaited<ReturnType<typeof saveResolutionAttachment>> = null;
  try {
    attachment = await saveResolutionAttachment(
      formData.get("resolutionAttachment") as File | null,
    );
    await db
      .update(repairTickets)
      .set({
        status: status!,
        problem: problem!,
        notes: str(formData.get("remarks")),
        resolution,
        ...(attachment
          ? {
              resolutionAttachmentUrl: attachment.url,
              resolutionAttachmentName: attachment.name,
            }
          : {}),
        dateClosed:
          status === "Closed"
            ? existing.dateClosed || new Date().toISOString().slice(0, 10)
            : null,
        updatedAt: new Date(),
      })
      .where(eq(repairTickets.id, id));
  } catch {
    if (attachment) await deleteResolutionAttachment(attachment.url);
    return { error: "Could not save the ticket. Attach a JPEG, PNG, or WebP image up to 5 MB." };
  }

  if (attachment && existing.resolutionAttachmentUrl) {
    await deleteResolutionAttachment(existing.resolutionAttachmentUrl);
  }

  revalidatePath("/repair-history");
  revalidatePath(`/repair-history/${id}`);
  revalidatePath("/dashboard");
  return { success: "Repair ticket updated successfully." };
}

export async function createReportAction(_prev: RepairFormState, formData: FormData): Promise<RepairFormState> {
  await requireSession(); // any logged-in user may submit a report

  const serialNumber = str(formData.get("serialNumber"));
  const requestedDate = str(formData.get("requestedDate"));
  const problem = str(formData.get("problem"));

  const fieldErrors: Record<string, string> = {};
  if (!serialNumber) fieldErrors.serialNumber = "Printer Serial Number is required.";
  if (!requestedDate) fieldErrors.requestedDate = "Requested Date is required.";
  if (!problem) fieldErrors.problem = "Concern description is required.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const printerRows = await db.select().from(printers).where(eq(printers.serialNumber, serialNumber!)).limit(1);
  const printer = printerRows[0];

  const ticketNumber = await generateTicketNumber();

  await db.insert(repairTickets).values({
    ticketNumber,
    serialNumber: serialNumber!,
    printerId: printer?.id ?? null,
    requestedDate: requestedDate!,
    departmentId: num(formData.get("departmentId")) ?? printer?.departmentId ?? null,
    locationId: num(formData.get("locationId")) ?? printer?.locationId ?? null,
    problem: problem!,
    vendorId: num(formData.get("vendorId")) ?? printer?.vendorId ?? null,
    notes: str(formData.get("remarks")),
    status: "Open",
  });

  await createNotification(`New repair ticket ${ticketNumber} reported for printer ${serialNumber}.`, "repair");

  revalidatePath("/repair-history");
  revalidatePath("/dashboard");
  redirect(`/repair-history?success=Ticket ${ticketNumber} created with status Open.`);
}

export async function updateTicketAction(_prev: RepairFormState, formData: FormData): Promise<RepairFormState> {
  await requireModuleFullAccess("repair");

  const id = num(formData.get("id"));
  if (!id) return { error: "Invalid ticket." };

  const status = str(formData.get("status")) || "Open";
  const resolution = str(formData.get("resolution"));
  if (status === "Closed" && !resolution) {
    return { fieldErrors: { resolution: "Resolution is required when closing a ticket." } };
  }
  const dateClosed = status === "Closed" ? str(formData.get("dateClosed")) || new Date().toISOString().slice(0, 10) : null;
  const [existing] = await db
    .select({ resolutionAttachmentUrl: repairTickets.resolutionAttachmentUrl })
    .from(repairTickets)
    .where(eq(repairTickets.id, id))
    .limit(1);
  if (!existing) return { error: "Repair ticket not found." };

  let attachment: Awaited<ReturnType<typeof saveResolutionAttachment>> = null;
  try {
    attachment = await saveResolutionAttachment(
      formData.get("resolutionAttachment") as File | null,
    );
    await db
      .update(repairTickets)
      .set({
        departmentId: num(formData.get("departmentId")),
        locationId: num(formData.get("locationId")),
        problem: str(formData.get("problem")) || "",
        vendorId: num(formData.get("vendorId")),
        resolution,
        ...(attachment
          ? {
              resolutionAttachmentUrl: attachment.url,
              resolutionAttachmentName: attachment.name,
            }
          : {}),
        status,
        dateClosed,
        updatedAt: new Date(),
      })
      .where(eq(repairTickets.id, id));
  } catch {
    if (attachment) await deleteResolutionAttachment(attachment.url);
    return { error: "Could not save the ticket. Attach a JPEG, PNG, or WebP image up to 5 MB." };
  }

  if (attachment && existing.resolutionAttachmentUrl) {
    await deleteResolutionAttachment(existing.resolutionAttachmentUrl);
  }

  revalidatePath("/repair-history");
  redirect("/repair-history?success=Repair ticket updated successfully.");
}

export async function deleteTicketAction(formData: FormData) {
  await requireModuleFullAccess("repair");
  const id = num(formData.get("id"));
  if (!id) return;
  const [ticket] = await db
    .select({ resolutionAttachmentUrl: repairTickets.resolutionAttachmentUrl })
    .from(repairTickets)
    .where(eq(repairTickets.id, id))
    .limit(1);
  await db.delete(repairTickets).where(eq(repairTickets.id, id));
  if (ticket?.resolutionAttachmentUrl) {
    await deleteResolutionAttachment(ticket.resolutionAttachmentUrl);
  }
  revalidatePath("/repair-history");
  redirect("/repair-history?success=Repair ticket deleted.");
}
