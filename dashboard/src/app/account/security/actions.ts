"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, userMfaRecoveryCodes, users } from "@/db/schema";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import {
  clearSuccessfulLogin,
  clearSuccessfulMfa,
  isLoginRateLimited,
  isMfaRateLimited,
  recordFailedLogin,
  recordFailedMfa,
} from "@/lib/auth-rate-limit";
import {
  assertMfaConfiguration,
  decryptMfaSecret,
  encryptMfaSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@/lib/mfa-secrets";
import { verifyAndConsumeMfaCredential } from "@/lib/mfa-verification";
import { requireSession } from "@/lib/server-utils";
import { generateTotpSecret, verifyTotpCode } from "@/lib/totp";

export type AccountMfaState = {
  success?: boolean;
  message?: string;
  error?: string;
  fieldErrors?: Partial<Record<"password" | "code", string>>;
  recoveryCodes?: string[];
};

async function currentAccount() {
  const session = await requireSession();
  const [account] = await db.select().from(users).where(eq(users.id, session.id)).limit(1);
  if (!account) throw new Error("Account not found");
  return { session, account };
}

async function replaceSession(account: typeof users.$inferSelect) {
  await setSessionCookie({
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    username: account.username,
    role: account.role as "super_admin" | "admin" | "support" | "employee",
    sessionVersion: account.sessionVersion,
  });
}

export async function beginMfaEnrollmentAction(
  _previous: AccountMfaState,
  formData: FormData,
): Promise<AccountMfaState> {
  const { account } = await currentAccount();
  if (account.totpEnabledAt && account.totpSecretEncrypted) {
    return { error: "Authenticator protection is already enabled." };
  }
  const password = String(formData.get("password") ?? "");
  if (!password) return { fieldErrors: { password: "Enter your current password." } };
  if (await isLoginRateLimited(account.username)) {
    return { error: "Too many password attempts. Please try again in 15 minutes." };
  }
  if (!await verifyPassword(password, account.passwordHash)) {
    await recordFailedLogin(account.username);
    return { fieldErrors: { password: "The current password is incorrect." } };
  }
  await clearSuccessfulLogin(account.username);
  try {
    assertMfaConfiguration();
    await db.update(users).set({
      totpPendingSecretEncrypted: encryptMfaSecret(generateTotpSecret()),
    }).where(eq(users.id, account.id));
  } catch {
    return { error: "Authenticator security is not configured on the server. Contact IT support." };
  }
  return { success: true, message: "Scan the setup code to continue." };
}

export async function confirmMfaEnrollmentAction(
  _previous: AccountMfaState,
  formData: FormData,
): Promise<AccountMfaState> {
  const { account } = await currentAccount();
  if (account.totpEnabledAt && account.totpSecretEncrypted) {
    return { error: "Authenticator protection is already enabled." };
  }
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    return { fieldErrors: { code: "Enter the six-digit code from your authenticator app." } };
  }
  if (await isMfaRateLimited(account.id)) {
    return { error: "Too many verification attempts. Please try again in 15 minutes." };
  }
  if (!account.totpPendingSecretEncrypted) return { error: "Start authenticator setup again." };
  let secret: string;
  try {
    secret = decryptMfaSecret(account.totpPendingSecretEncrypted);
  } catch {
    return { error: "Authenticator security is not configured correctly. Contact IT support." };
  }
  const usedStep = verifyTotpCode(code, secret, { window: 1 });
  if (usedStep == null) {
    await recordFailedMfa(account.id);
    return { fieldErrors: { code: "That code is invalid. Wait for a new code and try again." } };
  }

  const recoveryCodes = generateRecoveryCodes();
  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx.update(users).set({
      totpSecretEncrypted: account.totpPendingSecretEncrypted,
      totpPendingSecretEncrypted: null,
      totpEnabledAt: new Date(),
      totpLastUsedStep: usedStep,
      sessionVersion: account.sessionVersion + 1,
    }).where(and(eq(users.id, account.id), eq(users.sessionVersion, account.sessionVersion))).returning();
    if (!rows.length) throw new Error("Account changed during authenticator setup");
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
      metadata: { requiredByRole: false },
    });
    return rows;
  });
  await clearSuccessfulMfa(account.id);
  await replaceSession(updated);
  return { success: true, message: "Authenticator protection is enabled.", recoveryCodes };
}

async function verifySensitiveMfaAction(formData: FormData) {
  const { account } = await currentAccount();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  const fieldErrors: AccountMfaState["fieldErrors"] = {};
  if (!password) fieldErrors.password = "Enter your current password.";
  if (!code) fieldErrors.code = "Enter an authenticator or recovery code.";
  if (Object.keys(fieldErrors).length) return { account, fieldErrors };
  if (await isLoginRateLimited(account.username)) {
    return { account, error: "Too many password attempts. Please try again in 15 minutes." };
  }
  if (!await verifyPassword(password, account.passwordHash)) {
    await recordFailedLogin(account.username);
    return { account, fieldErrors: { password: "The current password is incorrect." } };
  }
  await clearSuccessfulLogin(account.username);
  if (!account.totpEnabledAt || !account.totpSecretEncrypted) {
    return { account, error: "Authenticator protection is not enabled." };
  }
  if (await isMfaRateLimited(account.id)) {
    return { account, error: "Too many verification attempts. Please try again in 15 minutes." };
  }
  try {
    const credentialType = await verifyAndConsumeMfaCredential({
      userId: account.id,
      encryptedSecret: account.totpSecretEncrypted,
      lastUsedStep: account.totpLastUsedStep,
      credential: code,
    });
    if (!credentialType) {
      await recordFailedMfa(account.id);
      return { account, fieldErrors: { code: "That code is invalid or has already been used." } };
    }
    return { account, credentialType };
  } catch {
    return { account, error: "Authenticator security is not configured correctly. Contact IT support." };
  }
}

export async function regenerateRecoveryCodesAction(
  _previous: AccountMfaState,
  formData: FormData,
): Promise<AccountMfaState> {
  const verification = await verifySensitiveMfaAction(formData);
  if (verification.error || verification.fieldErrors) {
    return { error: verification.error, fieldErrors: verification.fieldErrors };
  }
  const { account } = verification;
  const recoveryCodes = generateRecoveryCodes();
  const [updated] = await db.transaction(async (tx) => {
    await tx.delete(userMfaRecoveryCodes).where(eq(userMfaRecoveryCodes.userId, account.id));
    await tx.insert(userMfaRecoveryCodes).values(recoveryCodes.map((value) => ({
      userId: account.id,
      codeHash: hashRecoveryCode(value),
    })));
    const rows = await tx.update(users).set({ sessionVersion: account.sessionVersion + 1 })
      .where(eq(users.id, account.id)).returning();
    await tx.insert(auditLogs).values({
      actorUserId: account.id,
      action: "auth.mfa_recovery_codes_regenerated",
      targetType: "user",
      targetId: String(account.id),
    });
    return rows;
  });
  await clearSuccessfulMfa(account.id);
  await replaceSession(updated);
  return { success: true, message: "New recovery codes created.", recoveryCodes };
}

export async function disableMfaAction(
  _previous: AccountMfaState,
  formData: FormData,
): Promise<AccountMfaState> {
  const verification = await verifySensitiveMfaAction(formData);
  if (verification.error || verification.fieldErrors) {
    return { error: verification.error, fieldErrors: verification.fieldErrors };
  }
  const { account } = verification;
  if (account.role === "admin" || account.role === "super_admin") {
    return { error: "Authenticator protection is required for administrator accounts and cannot be disabled." };
  }
  const [updated] = await db.transaction(async (tx) => {
    await tx.delete(userMfaRecoveryCodes).where(eq(userMfaRecoveryCodes.userId, account.id));
    const rows = await tx.update(users).set({
      totpSecretEncrypted: null,
      totpPendingSecretEncrypted: null,
      totpEnabledAt: null,
      totpLastUsedStep: null,
      sessionVersion: account.sessionVersion + 1,
    }).where(eq(users.id, account.id)).returning();
    await tx.insert(auditLogs).values({
      actorUserId: account.id,
      action: "auth.mfa_disabled",
      targetType: "user",
      targetId: String(account.id),
    });
    return rows;
  });
  await clearSuccessfulMfa(account.id);
  await replaceSession(updated);
  return { success: true, message: "Authenticator protection is disabled." };
}
