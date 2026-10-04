"use server";

import { and, eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import {
  hashPassword,
  isValidPassword,
  PASSWORD_RULE_TEXT,
  setSessionCookie,
  verifyPassword,
} from "@/lib/auth";
import { isUserRole, type UserRole } from "@/lib/roles";
import { requireSession } from "@/lib/server-utils";

export type TemporaryPasswordChangeState = {
  error?: string;
  fieldErrors?: Partial<Record<"password" | "confirmPassword", string>>;
};

function defaultDestination(role: UserRole) {
  return role === "employee" ? "/portal" : role === "support" ? "/" : "/overview";
}

function safeDestination(value: FormDataEntryValue | null, role: UserRole) {
  const requested = String(value ?? "");
  if (
    !requested.startsWith("/")
    || requested.startsWith("//")
    || requested.startsWith("/login")
    || requested.startsWith("/account/change-password")
  ) return defaultDestination(role);
  return requested;
}

export async function changeTemporaryPasswordAction(
  _previous: TemporaryPasswordChangeState,
  formData: FormData,
): Promise<TemporaryPasswordChangeState> {
  const session = await requireSession();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const destination = safeDestination(formData.get("next"), session.role);
  const fieldErrors: TemporaryPasswordChangeState["fieldErrors"] = {};

  if (!password) fieldErrors.password = "Enter a new password.";
  else if (!isValidPassword(password)) fieldErrors.password = PASSWORD_RULE_TEXT;
  if (!confirmPassword) fieldErrors.confirmPassword = "Re-type your new password.";
  else if (password !== confirmPassword) fieldErrors.confirmPassword = "The passwords do not match.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const [account] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!account || !isUserRole(account.role) || account.accountStatus !== "active") {
    return { error: "Your account could not be verified. Sign in again." };
  }
  if (!account.passwordChangeRequired) redirect(destination);
  if (await verifyPassword(password, account.passwordHash)) {
    return { fieldErrors: { password: "Choose a password different from the temporary password." } };
  }

  const passwordHash = await hashPassword(password);
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(users)
      .set({
        passwordHash,
        passwordChangeRequired: false,
        temporaryPasswordExpiresAt: null,
        sessionVersion: sql`${users.sessionVersion} + 1`,
      })
      .where(and(eq(users.id, account.id), eq(users.passwordChangeRequired, true)))
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        username: users.username,
        role: users.role,
        sessionVersion: users.sessionVersion,
      });
    if (!rows[0]) return [];
    await tx.insert(auditLogs).values({
      actorUserId: account.id,
      action: "account.temporary_password_changed",
      targetType: "user",
      targetId: String(account.id),
      metadata: {},
    });
    return rows;
  });
  if (!updated || !isUserRole(updated.role)) {
    return { error: "The password was already changed in another session. Sign in again." };
  }

  await setSessionCookie({
    id: updated.id,
    fullName: updated.fullName,
    email: updated.email,
    username: updated.username,
    role: updated.role,
    sessionVersion: updated.sessionVersion,
  });
  redirect(destination);
}

export async function skipTemporaryPasswordChangeAction(formData: FormData) {
  const session = await requireSession();
  const destination = safeDestination(formData.get("next"), session.role);
  const [account] = await db
    .select({
      passwordChangeRequired: users.passwordChangeRequired,
      temporaryPasswordExpiresAt: users.temporaryPasswordExpiresAt,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);

  if (!account?.passwordChangeRequired) redirect(destination);
  if (!account.temporaryPasswordExpiresAt || account.temporaryPasswordExpiresAt.getTime() <= Date.now()) {
    redirect(`/account/change-password?next=${encodeURIComponent(destination)}&expired=1`);
  }

  await db.insert(auditLogs).values({
    actorUserId: session.id,
    action: "account.temporary_password_skipped",
    targetType: "user",
    targetId: String(session.id),
    metadata: { expiresAt: account.temporaryPasswordExpiresAt.toISOString() },
  });
  redirect(destination);
}
