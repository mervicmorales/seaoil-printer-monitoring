import { NextResponse } from "next/server";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { printOpsCommands } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getModuleAccessMap } from "@/lib/server-utils";
import { isSuperAdmin } from "@/lib/roles";
import { purgeExpiredScanFiles, SCAN_RETENTION_MS } from "@/lib/scan-retention";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const access = await getModuleAccessMap(session.id, session.role);
  const employeeMode = session.role === "employee";
  if (!employeeMode && !access.printops) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ message: "Invalid scan ID" }, { status: 400 });
  }
  await purgeExpiredScanFiles();

  const conditions = [
    eq(printOpsCommands.id, id),
    eq(printOpsCommands.type, "scan"),
    eq(printOpsCommands.status, "completed"),
    gt(printOpsCommands.completedAt, new Date(Date.now() - SCAN_RETENTION_MS)),
  ];
  if (!isSuperAdmin(session.role)) {
    conditions.push(eq(printOpsCommands.requestedBy, session.id));
  }
  const [scan] = await db
    .select({
      name: printOpsCommands.outputFileName,
      mimeType: printOpsCommands.outputMimeType,
      data: printOpsCommands.outputFileData,
    })
    .from(printOpsCommands)
    .where(and(...conditions))
    .limit(1);

  if (!scan?.data || !scan.name) {
    return NextResponse.json({ message: "Scan file not found" }, { status: 404 });
  }
  const file = Buffer.from(scan.data, "base64");
  const safeName = scan.name.replace(/["\\\r\n]/g, "_");
  const disposition = new URL(request.url).searchParams.get("view") === "1"
    ? "inline"
    : "attachment";
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": scan.mimeType || "application/pdf",
      "Content-Length": String(file.length),
      "Content-Disposition": `${disposition}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
