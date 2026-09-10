"use server";

import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { monitoringAgentLocations, monitoringAgents, printOpsCommands } from "@/db/schema";
import {
  getModuleAccessMap,
  requireModuleFullAccess,
  requireSession,
} from "@/lib/server-utils";
import { normalizePrintOpsSnapshot } from "@/lib/printops";
import { getPrintOpsLocationScope } from "./data";

const PRINTOPS_ROUTES = new Set([
  "/printops/print",
  "/printops/scan",
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
  const session = await requireModuleFullAccess("printops");
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

export async function queueDurablePrintAction(formData: FormData) {
  const { session, locationScope, returnTo } = await requirePrintServiceRequest("print");
  const target = parseTarget(formData.get("target"));
  const agentId = await validateAgent(
    target.agentId,
    returnTo,
    locationScope?.locationId,
  );
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
    redirectWith(returnTo, "error", "Select an online printer.");
  }
  const userPermissionFilter = session.role === "employee" || session.role === "support"
    ? sql`and (
          (
            printers.location_id = ${locationScope?.locationId ?? null}
            and printers.department_id = ${locationScope?.departmentId ?? null}
          )
          or exists (
            select 1
            from user_printer_permissions permission
            where permission.user_id = ${session.id}
              and permission.printer_id = printers.id
          )
        )`
    : sql``;
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
      ${userPermissionFilter}
    limit 1
  `);
  if (!availablePrinter.rows[0]) {
    redirectWith(returnTo, "error", "The selected printer is not available for your account.");
  }
  if (!Number.isInteger(copies) || copies < 1 || copies > 99) {
    redirectWith(returnTo, "error", "Copies must be from 1 to 99.");
  }
  if (!new Set(["none", "long", "short"]).has(duplex)) {
    redirectWith(returnTo, "error", "Select a valid duplex option.");
  }
  if (!new Set(["all", "custom"]).has(pageMode)) {
    redirectWith(returnTo, "error", "Select a valid page option.");
  }
  if (
    pageMode === "custom" &&
    (!pageRanges || pageRanges.length > 100 || !/^\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/.test(pageRanges))
  ) {
    redirectWith(returnTo, "error", "Enter page ranges like 1-3, 5.");
  }
  if (!new Set(["color", "grayscale"]).has(colorMode)) {
    redirectWith(returnTo, "error", "Select a valid color mode.");
  }
  if (!new Set(["a4", "letter", "legal", "a3"]).has(paperSize)) {
    redirectWith(returnTo, "error", "Select a valid paper size.");
  }
  if (!new Set(["portrait", "landscape"]).has(orientation)) {
    redirectWith(returnTo, "error", "Select a valid page layout.");
  }
  if (![1, 2, 4, 6, 9, 16].includes(pagesPerSheet)) {
    redirectWith(returnTo, "error", "Select a valid pages-per-sheet option.");
  }
  if (!new Set(["draft", "normal", "high"]).has(quality)) {
    redirectWith(returnTo, "error", "Select a valid print quality.");
  }
  if (!new Set(["fit", "100", "75", "50"]).has(scale)) {
    redirectWith(returnTo, "error", "Select a valid print scale.");
  }
  if (!(file instanceof File) || file.size === 0) {
    redirectWith(returnTo, "error", "Choose a file to print.");
  }
  if (file.size > MAX_PRINT_FILE_BYTES) {
    redirectWith(returnTo, "error", "Print files must be 10 MB or smaller.");
  }
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_PRINT_EXTENSIONS.has(extension)) {
    redirectWith(returnTo, "error", "Use a PDF, TXT, JPG, PNG, DOC, or DOCX file.");
  }

  const fileData = Buffer.from(await file.arrayBuffer()).toString("base64");
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
    },
    inputFileName: file.name.slice(0, 255),
    inputMimeType: file.type.slice(0, 255) || "application/octet-stream",
    inputFileData: fileData,
  });
  revalidatePrintOps();
  redirectWith(returnTo, "success", "Print job queued for the office agent.");
}

export async function queueScanAction(formData: FormData) {
  const { session, locationScope, returnTo } = await requirePrintServiceRequest("scan");
  const target = parseTarget(formData.get("target"));
  const agentId = await validateAgent(
    target.agentId,
    returnTo,
    locationScope?.locationId,
  );
  const device = target.value.trim();
  const source = String(formData.get("source") ?? "Flatbed");
  if (!device || device.length > 1_000) {
    redirectWith(returnTo, "error", "Select a scanner.");
  }
  if (!new Set(["Flatbed", "ADF", "ADF Duplex"]).has(source)) {
    redirectWith(returnTo, "error", "Select a valid scan source.");
  }
  await validateScanDevice(agentId, device, returnTo);
  await db.insert(printOpsCommands).values({
    agentId,
    requestedBy: session.id,
    type: "scan",
    payload: { device, source },
  });
  revalidatePrintOps();
  redirectWith(returnTo, "success", "Scan queued for the office agent.");
}

async function requirePrintServiceRequest(operation: "print" | "scan") {
  const session = await requireSession();
  const returnTo = session.role === "employee"
    ? `/portal/${operation}`
    : `/printops/${operation}`;

  const locationScoped = session.role === "employee" || session.role === "support";
  if (!locationScoped) {
    const access = await getModuleAccessMap(session.id, session.role);
    if (!access.printops) redirect("/access-denied");
    return { session, locationScope: null, returnTo };
  }

  if (session.role === "support") {
    const access = await getModuleAccessMap(session.id, session.role);
    if (!access.printops) redirect("/access-denied");
  }

  const accountScope = await getPrintOpsLocationScope(session.id);
  if (!accountScope) {
    redirectWith(
      returnTo,
      "error",
      "Your account needs an assigned location and department before you can use printer services.",
    );
  }
  const locationScope = accountScope;
  return { session, locationScope, returnTo };
}

async function validateAgent(
  value: FormDataEntryValue | number | null,
  returnTo: string,
  employeeLocationId?: number,
) {
  const agentId = Number(String(value ?? ""));
  if (!Number.isSafeInteger(agentId) || agentId < 1) {
    redirectWith(returnTo, "error", "Select a monitoring agent.");
  }
  const [agent] = await db
    .select({
      id: monitoringAgents.id,
      locationId: monitoringAgents.locationId,
    })
    .from(monitoringAgents)
    .leftJoin(
      monitoringAgentLocations,
      eq(monitoringAgentLocations.agentId, monitoringAgents.id),
    )
    .where(
      and(
        eq(monitoringAgents.id, agentId),
        isNotNull(monitoringAgents.tokenHash),
        isNull(monitoringAgents.tokenRevokedAt),
        employeeLocationId === undefined
          ? undefined
          : or(
              eq(monitoringAgents.locationId, employeeLocationId),
              eq(monitoringAgentLocations.locationId, employeeLocationId),
            ),
      ),
    )
    .limit(1);
  if (!agent) {
    redirectWith(returnTo, "error", "The selected agent is unavailable.");
  }
  return agentId;
}

async function validateScanDevice(
  agentId: number,
  deviceId: string,
  returnTo: string,
) {
  const [latestSync] = await db
    .select({ result: printOpsCommands.result })
    .from(printOpsCommands)
    .where(and(
      eq(printOpsCommands.agentId, agentId),
      eq(printOpsCommands.type, "sync"),
      eq(printOpsCommands.status, "completed"),
    ))
    .orderBy(desc(printOpsCommands.completedAt), desc(printOpsCommands.id))
    .limit(1);
  const available = normalizePrintOpsSnapshot(latestSync?.result)
    .scanDevices.some((device) => device.id === deviceId);
  if (!available) {
    redirectWith(returnTo, "error", "The selected scanner is no longer available.");
  }
}

function parseTarget(value: FormDataEntryValue | null) {
  const raw = String(value ?? "");
  const separator = raw.indexOf("|");
  if (separator < 1) return { agentId: null, value: "" };
  return { agentId: Number(raw.slice(0, separator)), value: raw.slice(separator + 1) };
}

function normalizeReturnTo(value: FormDataEntryValue | null) {
  const path = String(value ?? "");
  return PRINTOPS_ROUTES.has(path) ? path : "/printops/print";
}

function revalidatePrintOps() {
  revalidatePath("/printops/print");
  revalidatePath("/printops/scan");
  revalidatePath("/portal/print");
  revalidatePath("/portal/scan");
}

function redirectWith(path: string, key: "success" | "error", message: string): never {
  redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}
