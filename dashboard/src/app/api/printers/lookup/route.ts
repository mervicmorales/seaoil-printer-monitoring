import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { printers, vendors } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const serial = req.nextUrl.searchParams.get("serial")?.trim();
  if (!serial) return NextResponse.json({ found: false });

  const rows = await db
    .select({
      id: printers.id,
      locationId: printers.locationId,
      departmentId: printers.departmentId,
      vendorId: printers.vendorId,
      vendorName: vendors.name,
    })
    .from(printers)
    .leftJoin(vendors, eq(printers.vendorId, vendors.id))
    .where(eq(printers.serialNumber, serial))
    .limit(1);

  const row = rows[0];
  if (!row) return NextResponse.json({ found: false });
  return NextResponse.json({ found: true, ...row });
}
