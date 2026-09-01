import { createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { manualUserVerificationTokens, userRegistrationRequests, users } from "@/db/schema";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") || "";
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();

  const activated = await db.transaction(async (tx) => {
    const [record] = await tx.select({
      id: manualUserVerificationTokens.id,
      userId: manualUserVerificationTokens.userId,
    }).from(manualUserVerificationTokens).where(and(
      eq(manualUserVerificationTokens.tokenHash, tokenHash),
      isNull(manualUserVerificationTokens.consumedAt),
      gt(manualUserVerificationTokens.expiresAt, now),
    )).limit(1);
    if (!record) return false;

    const consumed = await tx.update(manualUserVerificationTokens).set({
      consumedAt: now,
    }).where(and(
      eq(manualUserVerificationTokens.id, record.id),
      isNull(manualUserVerificationTokens.consumedAt),
    )).returning({ id: manualUserVerificationTokens.id });
    if (!consumed.length) return false;

    const updated = await tx.update(users).set({
      accountStatus: "active",
      emailVerifiedAt: now,
    }).where(and(
      eq(users.id, record.userId),
      eq(users.accountStatus, "pending_email"),
    )).returning({ id: users.id });
    if (updated.length) {
      await tx.update(userRegistrationRequests).set({
        status: "approved",
        emailVerifiedAt: now,
      }).where(and(
        eq(userRegistrationRequests.userId, record.userId),
        eq(userRegistrationRequests.source, "manual"),
      ));
    }
    return updated.length > 0;
  });

  const target = new URL("/login", request.url);
  target.searchParams.set("verified", activated ? "account-activated" : "invalid");
  return NextResponse.redirect(target);
}
