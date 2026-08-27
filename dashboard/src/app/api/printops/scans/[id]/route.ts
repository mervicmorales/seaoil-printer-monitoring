import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { printOpsCommands } from "@/db/schema";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return NextResponse.json({ message: "Invalid scan ID" }, { status: 400 });
  }

  const conditions = [
    eq(printOpsCommands.id, id),
    eq(printOpsCommands.type, "scan"),
    eq(printOpsCommands.status, "completed"),
  ];
  if (session.role !== "admin") {
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
  return new NextResponse(new Uint8Array(file), {
    headers: {
      "Content-Type": scan.mimeType || "application/pdf",
      "Content-Length": String(file.length),
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
