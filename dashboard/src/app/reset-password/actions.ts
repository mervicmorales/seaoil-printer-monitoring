"use server";

import { createHash } from "crypto";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs, passwordResetTokens, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { isValidPassword, PASSWORD_RULE_TEXT } from "@/lib/validation";

export type ResetPasswordState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fieldErrors: Record<string, string> = {};

  if (!isValidPassword(password)) fieldErrors.password = PASSWORD_RULE_TEXT;
  if (!confirmPassword) fieldErrors.confirmPassword = "Confirm your new password.";
  else if (password !== confirmPassword) fieldErrors.confirmPassword = "Passwords do not match.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };
  if (!token) return { error: "This password reset link is invalid or has expired." };

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const passwordHash = await hashPassword(password);

  const changed = await db.transaction(async (tx) => {
    const [record] = await tx
      .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.consumedAt),
        gt(passwordResetTokens.expiresAt, now),
      ))
      .limit(1);
    if (!record) return false;

    const consumed = await tx
      .update(passwordResetTokens)
      .set({ consumedAt: now })
      .where(and(
        eq(passwordResetTokens.id, record.id),
        isNull(passwordResetTokens.consumedAt),
      ))
      .returning({ id: passwordResetTokens.id });
    if (!consumed.length) return false;

    const updated = await tx
      .update(users)
      .set({ passwordHash, sessionVersion: sql`${users.sessionVersion} + 1` })
      .where(eq(users.id, record.userId))
      .returning({ id: users.id });
    if (!updated.length) return false;

    await tx
      .update(passwordResetTokens)
      .set({ consumedAt: now })
      .where(and(
        eq(passwordResetTokens.userId, record.userId),
        isNull(passwordResetTokens.consumedAt),
      ));
    await tx.insert(auditLogs).values({
      actorUserId: null,
      action: "account.password_reset",
      targetType: "user",
      targetId: String(record.userId),
      metadata: {},
    });
    return true;
  });

  if (!changed) return { error: "This password reset link is invalid or has expired." };
  redirect("/login?reset=success");
}
