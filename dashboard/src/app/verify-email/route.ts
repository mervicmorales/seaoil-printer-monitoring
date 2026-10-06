import { createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { emailVerificationTokens, userRegistrationRequests } from "@/db/schema";
import { publicApplicationUrl } from "@/lib/public-application-url";
import { expireRegistrationRequests } from "@/lib/registration-requests";

export async function GET(request: Request) {
  await expireRegistrationRequests();
  const token = new URL(request.url).searchParams.get("token") || "";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const target = publicApplicationUrl("/login", request.url);
  const verified = await db.transaction(async (tx) => {
    const [record] = await tx.select({ id: emailVerificationTokens.id, requestId: emailVerificationTokens.registrationRequestId })
      .from(emailVerificationTokens).where(and(eq(emailVerificationTokens.tokenHash, tokenHash), isNull(emailVerificationTokens.consumedAt), gt(emailVerificationTokens.expiresAt, now))).limit(1);
    if (!record) return false;
    const consumed = await tx.update(emailVerificationTokens).set({ consumedAt: now }).where(and(eq(emailVerificationTokens.id, record.id), isNull(emailVerificationTokens.consumedAt))).returning({ id: emailVerificationTokens.id });
    if (!consumed.length) return false;
    const updated = await tx.update(userRegistrationRequests).set({ status: "pending_admin", emailVerifiedAt: now }).where(and(eq(userRegistrationRequests.id, record.requestId), eq(userRegistrationRequests.status, "pending_email"))).returning({ id: userRegistrationRequests.id });
    return updated.length > 0;
  });
  target.searchParams.set("verified", verified ? "1" : "0");
  return NextResponse.redirect(target);
}
