"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { auditLogs, userMfaRecoveryCodes, users } from "@/db/schema";
import {
  clearMfaChallengeCookie,
  getMfaChallenge,
  getSession,
  setSessionCookie,
} from "@/lib/auth";
import {
  clearSuccessfulLogin,
  clearSuccessfulMfa,
  isMfaRateLimited,
  recordFailedMfa,
} from "@/lib/auth-rate-limit";
import {
  decryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@/lib/mfa-secrets";
import { verifyAndConsumeMfaCredential } from "@/lib/mfa-verification";
import { isUserRole } from "@/lib/roles";
import { verifyTotpCode } from "@/lib/totp";

export type VerifyMfaState = {
  error?: string;
  success?: boolean;
  recoveryCodes?: string[];
  redirectTo?: string;
};

async function challengeAccount(expectedPurpose: "verify" | "enroll") {
  const challenge = await getMfaChallenge();
  if (!challenge || challenge.purpose !== expectedPurpose) return null;
  const [account] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, challenge.userId), eq(users.sessionVersion, challenge.sessionVersion)))
    .limit(1);
  if (
    !account
    || account.accountStatus !== "active"
    || !isUserRole(account.role)
    || account.role !== challenge.role
  ) return null;
  return { challenge, account: { ...account, role: account.role } };
}

export async function verifyMfaLoginAction(
  _previous: VerifyMfaState,
  formData: FormData,
): Promise<VerifyMfaState> {
  const context = await challengeAccount("verify");
  if (!context) return { error: "Your verification session expired. Sign in again." };
  const { account, challenge } = context;
  if (await isMfaRateLimited(account.id)) {
    return { error: "Too many verification attempts. Please try again in 15 minutes." };
  }
  const credential = String(formData.get("credential") ?? "").trim();
  if (!credential) return { error: "Enter your authenticator code or a recovery code." };
  if (!account.totpEnabledAt || !account.totpSecretEncrypted) {
    return { error: "Authenticator verification is not available for this account." };
  }

  let credentialType: "totp" | "recovery" | null = null;
  try {
    credentialType = await verifyAndConsumeMfaCredential({
      userId: account.id,
      encryptedSecret: account.totpSecretEncrypted,
      lastUsedStep: account.totpLastUsedStep,
      credential,
    });
  } catch {
    return { error: "Authenticator verification is not configured correctly. Contact IT support." };
  }
  if (!credentialType) {
    await recordFailedMfa(account.id);
    return { error: "That authenticator or recovery code is invalid or has already been used." };
  }

  if (credentialType === "recovery") {
    await db.insert(auditLogs).values({
      actorUserId: account.id,
      action: "auth.mfa_recovery_code_used",
      targetType: "user",
      targetId: String(account.id),
    });
  }
  await Promise.all([
    clearSuccessfulMfa(account.id),
    clearSuccessfulLogin(challenge.loginIdentifier),
  ]);
  await setSessionCookie({
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    username: account.username,
    role: account.role,
    sessionVersion: account.sessionVersion,
  });
  await clearMfaChallengeCookie();
  redirect(challenge.redirectTo);
}

export async function confirmRequiredMfaEnrollmentAction(
  _previous: VerifyMfaState,
  formData: FormData,
): Promise<VerifyMfaState> {
  const context = await challengeAccount("enroll");
  if (!context) return { error: "Your setup session expired. Sign in again." };
  const { account, challenge } = context;
  if (await isMfaRateLimited(account.id)) {
    return { error: "Too many verification attempts. Please try again in 15 minutes." };
  }
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    return { error: "Enter the six-digit code shown in your authenticator app." };
  }
  if (!account.totpPendingSecretEncrypted) {
    return { error: "Authenticator setup is no longer available. Sign in again to restart it." };
  }

  let secret: string;
  try {
    secret = decryptMfaSecret(account.totpPendingSecretEncrypted);
  } catch {
    return { error: "Authenticator setup is not configured correctly. Contact IT support." };
  }
  const usedStep = verifyTotpCode(code, secret, { window: 1 });
  if (usedStep == null) {
    await recordFailedMfa(account.id);
    return { error: "That code is invalid. Wait for a new code and try again." };
  }

  const recoveryCodes = generateRecoveryCodes();
  const [updated] = await db.transaction(async (tx) => {
    const updatedRows = await tx
      .update(users)
      .set({
        totpSecretEncrypted: account.totpPendingSecretEncrypted,
        totpPendingSecretEncrypted: null,
        totpEnabledAt: new Date(),
        totpLastUsedStep: usedStep,
        sessionVersion: account.sessionVersion + 1,
      })
      .where(and(eq(users.id, account.id), eq(users.sessionVersion, account.sessionVersion)))
      .returning();
    if (!updatedRows.length) throw new Error("Account changed during authenticator setup");
    await tx.delete(userMfaRecoveryCodes).where(eq(userMfaRecoveryCodes.userId, account.id));
    await tx.insert(userMfaRecoveryCodes).values(recoveryCodes.map((value) => ({
      userId: account.id,
      codeHash: hashRecoveryCode(value),
    })));
    await tx.insert(auditLogs).values({
      actorUserId: account.id,
      action: "auth.mfa_enabled",
      targetType: "user",
      targetId: String(account.id),
      metadata: { requiredByRole: true },
    });
    return updatedRows;
  });

  await Promise.all([
    clearSuccessfulMfa(account.id),
    clearSuccessfulLogin(challenge.loginIdentifier),
  ]);
  await setSessionCookie({
    id: updated.id,
    fullName: updated.fullName,
    email: updated.email,
    username: updated.username,
    role: account.role,
    sessionVersion: updated.sessionVersion,
  });
  return { success: true, recoveryCodes, redirectTo: challenge.redirectTo };
}

export async function completeRequiredMfaEnrollmentAction() {
  const [session, challenge] = await Promise.all([getSession(), getMfaChallenge()]);
  if (!session) redirect("/login");
  const redirectTo = challenge?.userId === session.id
    ? challenge.redirectTo
    : session.role === "employee"
      ? "/portal"
      : session.role === "support"
        ? "/"
        : "/overview";
  await clearMfaChallengeCookie();
  redirect(redirectTo);
}
