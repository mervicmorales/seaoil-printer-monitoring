import "server-only";

import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { userMfaRecoveryCodes, users } from "@/db/schema";
import { decryptMfaSecret, hashRecoveryCode } from "@/lib/mfa-secrets";
import { normalizeRecoveryCode, verifyTotpCode } from "@/lib/totp";

export type MfaCredentialType = "totp" | "recovery";

export async function verifyAndConsumeMfaCredential({
  userId,
  encryptedSecret,
  lastUsedStep,
  credential,
}: {
  userId: number;
  encryptedSecret: string;
  lastUsedStep: number | null;
  credential: string;
}): Promise<MfaCredentialType | null> {
  const compact = credential.replace(/\s/g, "");
  if (/^\d{6}$/.test(compact)) {
    const secret = decryptMfaSecret(encryptedSecret);
    const step = verifyTotpCode(compact, secret, { window: 1, afterStep: lastUsedStep });
    if (step == null) return null;
    const claimed = await db
      .update(users)
      .set({ totpLastUsedStep: step })
      .where(and(
        eq(users.id, userId),
        or(isNull(users.totpLastUsedStep), lt(users.totpLastUsedStep, step)),
      ))
      .returning({ id: users.id });
    return claimed.length ? "totp" : null;
  }

  const normalized = normalizeRecoveryCode(credential);
  if (normalized.length !== 16) return null;
  const consumed = await db
    .update(userMfaRecoveryCodes)
    .set({ usedAt: new Date() })
    .where(and(
      eq(userMfaRecoveryCodes.userId, userId),
      eq(userMfaRecoveryCodes.codeHash, hashRecoveryCode(normalized)),
      isNull(userMfaRecoveryCodes.usedAt),
    ))
    .returning({ id: userMfaRecoveryCodes.id });
  return consumed.length ? "recovery" : null;
}
