import { db } from "@/db";
import { sql } from "drizzle-orm";
import { assertAuthConfiguration } from "@/lib/auth";
import { assertMfaConfiguration } from "@/lib/mfa-secrets";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    assertAuthConfiguration();
    assertMfaConfiguration();
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
