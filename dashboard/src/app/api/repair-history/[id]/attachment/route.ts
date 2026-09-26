import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import path from "path";
import { db } from "@/db";
import { repairTickets } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getModuleAccessMap } from "@/lib/server-utils";
import { readStoredUpload, uploadFilename } from "@/lib/private-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const access = await getModuleAccessMap(session.id, session.role);
  if (!access.repair) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid ticket" }, { status: 400 });
  const [record] = await db.select({ attachmentUrl: repairTickets.resolutionAttachmentUrl })
    .from(repairTickets).where(eq(repairTickets.id, id)).limit(1);
  const filename = uploadFilename("repair-resolutions", record?.attachmentUrl ?? null);
  if (!filename) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  const data = await readStoredUpload("repair-resolutions", record.attachmentUrl);
  if (!data) return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  const extension = path.extname(filename).toLowerCase();
  const contentType = extension === ".png" ? "image/png"
    : extension === ".webp" ? "image/webp"
    : "image/jpeg";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="repair-attachment${extension}"`,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
