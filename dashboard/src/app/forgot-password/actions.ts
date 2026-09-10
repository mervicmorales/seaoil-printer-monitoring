"use server";

import { createHash, randomBytes } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { buildPasswordResetEmail } from "@/lib/email-templates";
import { isValidEmail } from "@/lib/validation";

export type ForgotPasswordState = {
  success?: string;
  fieldErrors?: Record<string, string>;
};

const GENERIC_SUCCESS =
  "If an active account matches that email address, a password reset link will arrive shortly.";
const RESET_TOKEN_LIFETIME_MS = 60 * 60_000;
const REQUEST_COOLDOWN_MS = 15 * 60_000;

async function applicationOrigin() {
  const requestHeaders = await headers();
  return (
    process.env.APP_BASE_URL?.replace(/\/$/, "") ||
    requestHeaders.get("origin") ||
    "http://localhost:3000"
  );
}

export async function requestPasswordResetAction(
  _previous: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { fieldErrors: { email: "Email address is required." } };
  if (!isValidEmail(email)) return { fieldErrors: { email: "Enter a valid email address." } };

  const [user] = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .where(and(eq(users.email, email), eq(users.accountStatus, "active")))
    .limit(1);

  if (!user) return { success: GENERIC_SUCCESS };

  const [recentToken] = await db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(and(
      eq(passwordResetTokens.userId, user.id),
      gt(passwordResetTokens.createdAt, new Date(Date.now() - REQUEST_COOLDOWN_MS)),
    ))
    .orderBy(desc(passwordResetTokens.createdAt))
    .limit(1);

  if (recentToken) return { success: GENERIC_SUCCESS };

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_LIFETIME_MS);

  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ consumedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.consumedAt),
      ));
    await tx.insert(passwordResetTokens).values({ userId: user.id, tokenHash, expiresAt });
  });

  const resetUrl = `${await applicationOrigin()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  try {
    await sendEmail({
      to: user.email,
      ...buildPasswordResetEmail({ fullName: user.fullName, resetUrl }),
    });
  } catch (error) {
    console.error("Password reset email failed:", error instanceof Error ? error.name : "UnknownError");
  }

  return { success: GENERIC_SUCCESS };
}
