import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import path from "path";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { getModuleAccessMap } from "@/lib/server-utils";
import { readStoredUpload, uploadFilename } from "@/lib/private-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const access = await getModuleAccessMap(session.id, session.role);
  if (!access.contract) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid contract" }, { status: 400 });
  const [record] = await db.select({ documentUrl: contracts.documentUrl }).from(contracts).where(eq(contracts.id, id)).limit(1);
  const filename = uploadFilename("contracts", record?.documentUrl ?? null);
  if (!filename) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const data = await readStoredUpload("contracts", record.documentUrl);
  if (!data) return NextResponse.json({ error: "Document not found" }, { status: 404 });
  const extension = path.extname(filename).toLowerCase();
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": TYPES[extension] || "application/octet-stream",
      "Content-Disposition": `attachment; filename="contract-document${extension}"`,
      "Content-Length": String(data.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
