"use server";

import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { monitoringAgents, printOpsCommands } from "@/db/schema";
import {
  discardPrintFile,
  holdPrintFile,
} from "@/lib/printops-file-transfer";
import { requireSession } from "@/lib/server-utils";

const PRINTOPS_ROUTES = new Set([
  "/printops/print",
  "/printops/scan",
  "/printops/jobs",
]);
const ALLOWED_PRINT_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".jpg",
  ".jpeg",
  ".png",
  ".doc",
  ".docx",
]);
const MAX_PRINT_FILE_BYTES = 10 * 1024 * 1024;

export async function queuePrintOpsSyncAction(formData: FormData) {
  const session = await requireSession();
  const returnTo = normalizeReturnTo(formData.get("returnTo"));
  const agentId = await validateAgent(formData.get("agentId"), returnTo);
  const active = await db
    .select({ id: printOpsCommands.id })
    .from(printOpsCommands)
    .where(
      and(
        eq(printOpsCommands.agentId, agentId),
        eq(printOpsCommands.type, "sync"),
        inArray(printOpsCommands.status, ["queued", "running"]),
      ),
    )
    .limit(1);
  if (active.length === 0) {
    await db.insert(printOpsCommands).values({
      agentId,
      requestedBy: session.id,
      type: "sync",
    });
  }
  revalidatePrintOps();
  redirectWith(returnTo, "success", "PrintOps refresh queued.");
}

export async function queuePrintAction(formData: FormData) {
  const session = await requireSession();
  const target = parseTarget(formData.get("target"));
  const agentId = await validateAgent(target.agentId, "/printops/print");
  const printerId = Number(target.value);
  const copies = Number(String(formData.get("copies") ?? ""));
  const duplex = String(formData.get("duplex") ?? "none");
  const pageMode = String(formData.get("pageMode") ?? "all");
  const pageRanges = String(formData.get("pageRanges") ?? "").replace(/\s/g, "");
  const colorMode = String(formData.get("colorMode") ?? "color");
  const paperSize = String(formData.get("paperSize") ?? "a4");
  const orientation = String(formData.get("orientation") ?? "portrait");
  const pagesPerSheet = Number(String(formData.get("pagesPerSheet") ?? "1"));
  const quality = String(formData.get("quality") ?? "normal");
  const scale = String(formData.get("scale") ?? "fit");
  const file = formData.get("file");

  if (!Number.isSafeInteger(printerId) || printerId < 1) {
    redirectWith("/printops/print", "error", "Select an online printer.");
  }
  const availablePrinter = await db.execute<{ name: string }>(sql`
    select coalesce(printers.asset_tag, printers.serial_number) as name
    from printer_monitoring_assignments assignments
    inner join printers on printers.id = assignments.printer_id
    inner join lateral (
      select online
      from printer_monitoring_readings
      where printer_id = printers.id and agent_id = assignments.agent_id
      order by checked_at desc, id desc
      limit 1
    ) latest_reading on true
    where assignments.agent_id = ${agentId}
      and assignments.printer_id = ${printerId}
      and latest_reading.online is true
    limit 1
  `);
  if (!availablePrinter.rows[0]) {
    redirectWith("/printops/print", "error", "The selected printer is not online for this agent.");
  }
  if (!Number.isInteger(copies) || copies < 1 || copies > 99) {
    redirectWith("/printops/print", "error", "Copies must be from 1 to 99.");
  }
  if (!new Set(["none", "long", "short"]).has(duplex)) {
    redirectWith("/printops/print", "error", "Select a valid duplex option.");
  }
  if (!new Set(["all", "custom"]).has(pageMode)) {
    redirectWith("/printops/print", "error", "Select a valid page option.");
  }
  if (
    pageMode === "custom" &&
    (!pageRanges || pageRanges.length > 100 || !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(pageRanges))
  ) {
    redirectWith("/printops/print", "error", "Enter page ranges like 1-3, 5.");
  }
  if (!new Set(["color", "grayscale"]).has(colorMode)) {
    redirectWith("/printops/print", "error", "Select a valid color mode.");
  }
  if (!new Set(["a4", "letter", "legal", "a3"]).has(paperSize)) {
    redirectWith("/printops/print", "error", "Select a valid paper size.");
  }
  if (!new Set(["portrait", "landscape"]).has(orientation)) {
    redirectWith("/printops/print", "error", "Select a valid page layout.");
  }
  if (![1, 2, 4, 6, 9, 16].includes(pagesPerSheet)) {
    redirectWith("/printops/print", "error", "Select a valid pages-per-sheet option.");
  }
  if (!new Set(["draft", "normal", "high"]).has(quality)) {
    redirectWith("/printops/print", "error", "Select a valid print quality.");
  }
  if (!new Set(["fit", "100", "75", "50"]).has(scale)) {
    redirectWith("/printops/print", "error", "Select a valid print scale.");
  }
  if (!(file instanceof File) || file.size === 0) {
    redirectWith("/printops/print", "error", "Choose a file to print.");
  }
  if (file.size > MAX_PRINT_FILE_BYTES) {
    redirectWith("/printops/print", "error", "Print files must be 10 MB or smaller.");
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_PRINT_EXTENSIONS.has(extension)) {
    redirectWith("/printops/print", "error", "Use a PDF, TXT, JPG, PNG, DOC, or DOCX file.");
  }

  const transferKey = randomUUID();
  try {
    holdPrintFile(transferKey, Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    redirectWith(
      "/printops/print",
      "error",
      error instanceof Error ? error.message : "The print file could not be transferred.",
    );
  }
  try {
    await db.insert(printOpsCommands).values({
      agentId,
      requestedBy: session.id,
      type: "print",
      payload: {
        printerId,
        printerName: availablePrinter.rows[0].name,
        copies,
        duplex,
        pageRanges: pageMode === "custom" ? pageRanges : null,
        colorMode,
        paperSize,
        orientation,
        pagesPerSheet,
        quality,
        scale,
        transferKey,
      },
      inputFileName: file.name.slice(0, 255),
      inputMimeType: file.type.slice(0, 255) || "application/octet-stream",
    });
  } catch (error) {
    discardPrintFile(transferKey);
    throw error;
  }
  revalidatePrintOps();
  redirectWith("/printops/print", "success", "Print job queued for the office agent.");
}

export async function queueScanAction(formData: FormData) {
  const session = await requireSession();
  const target = parseTarget(formData.get("target"));
  const agentId = await validateAgent(target.agentId, "/printops/scan");
  const device = target.value.trim();
  const source = String(formData.get("source") ?? "Flatbed");
  if (!device || device.length > 1_000) {
    redirectWith("/printops/scan", "error", "Select a scanner.");
  }
  if (!new Set(["Flatbed", "ADF", "ADF Duplex"]).has(source)) {
    redirectWith("/printops/scan", "error", "Select a valid scan source.");
  }
  await db.insert(printOpsCommands).values({
    agentId,
    requestedBy: session.id,
    type: "scan",
    payload: { device, source },
  });
  revalidatePrintOps();
  redirectWith("/printops/scan", "success", "Scan queued for the office agent.");
}

export async function cancelPrintJobAction(formData: FormData) {
  const session = await requireSession();
  const agentId = await validateAgent(formData.get("agentId"), "/printops/jobs");
  const jobId = String(formData.get("jobId") ?? "");
  if (!/^[a-zA-Z0-9_.-]+$/.test(jobId)) {
    redirectWith("/printops/jobs", "error", "The CUPS job ID is invalid.");
  }
  await db.insert(printOpsCommands).values({
    agentId,
    requestedBy: session.id,
    type: "cancel-job",
    payload: { jobId },
  });
  revalidatePrintOps();
  redirectWith("/printops/jobs", "success", `Cancellation queued for ${jobId}.`);
}

async function validateAgent(
  value: FormDataEntryValue | number | null,
  returnTo: string,
) {
  const agentId = Number(String(value ?? ""));
  if (!Number.isSafeInteger(agentId) || agentId < 1) {
    redirectWith(returnTo, "error", "Select a monitoring agent.");
  }
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
  if (!agent) redirectWith(returnTo, "error", "The selected agent is unavailable.");
  return agentId;
}

function parseTarget(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  const separator = raw.indexOf("|");
  if (separator < 1) return { agentId: null, value: "" };
  return { agentId: Number(raw.slice(0, separator)), value: raw.slice(separator + 1) };
}

function normalizeReturnTo(value: FormDataEntryValue | null) {
  const path = String(value ?? "");
  return PRINTOPS_ROUTES.has(path) ? path : "/printops/jobs";
}

function revalidatePrintOps() {
  revalidatePath("/printops/print");
  revalidatePath("/printops/scan");
  revalidatePath("/printops/jobs");
}

function redirectWith(path: string, key: "success" | "error", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}
