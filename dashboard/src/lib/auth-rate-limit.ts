import "server-only";

import { createHash } from "crypto";
import { headers } from "next/headers";
import { eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { authRateLimits } from "@/db/schema";

const WINDOW_MS = 15 * 60 * 1000;
const IDENTIFIER_LIMIT = 5;
const ADDRESS_LIMIT = 20;
const MFA_USER_LIMIT = 5;
const MFA_ADDRESS_LIMIT = 20;

function hashKey(kind: string, value: string) {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

async function keysFor(identifier: string) {
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-real-ip")
    || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    identifierKey: hashKey("identifier", identifier.trim().toLowerCase()),
    addressKey: address ? hashKey("address", address) : null,
  };
}

async function mfaKeysFor(userId: number) {
  const requestHeaders = await headers();
  const address = requestHeaders.get("x-real-ip")
    || requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  return {
    userKey: hashKey("mfa-user", String(userId)),
    addressKey: address ? hashKey("mfa-address", address) : null,
  };
}

async function recordFailures(keys: string[]) {
  const cutoff = new Date(Date.now() - WINDOW_MS);
  for (const key of keys) {
    await db.insert(authRateLimits).values({ key, failures: 1 })
      .onConflictDoUpdate({
        target: authRateLimits.key,
        set: {
          failures: sql`case when ${authRateLimits.windowStartedAt} < ${cutoff} then 1 else ${authRateLimits.failures} + 1 end`,
          windowStartedAt: sql`case when ${authRateLimits.windowStartedAt} < ${cutoff} then now() else ${authRateLimits.windowStartedAt} end`,
        },
      });
  }
  if (Math.random() < 0.01) {
    await db.delete(authRateLimits).where(lt(authRateLimits.windowStartedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
  }
}

export async function isLoginRateLimited(identifier: string) {
  const { identifierKey, addressKey } = await keysFor(identifier);
  const keys = addressKey ? [identifierKey, addressKey] : [identifierKey];
  const rows = await db.select().from(authRateLimits).where(inArray(authRateLimits.key, keys));
  const cutoff = Date.now() - WINDOW_MS;
  return rows.some((row) => row.windowStartedAt.getTime() >= cutoff
    && row.failures >= (row.key === identifierKey ? IDENTIFIER_LIMIT : ADDRESS_LIMIT));
}

export async function recordFailedLogin(identifier: string) {
  const { identifierKey, addressKey } = await keysFor(identifier);
  const keys = addressKey ? [identifierKey, addressKey] : [identifierKey];
  await recordFailures(keys);
}

export async function isMfaRateLimited(userId: number) {
  const { userKey, addressKey } = await mfaKeysFor(userId);
  const keys = addressKey ? [userKey, addressKey] : [userKey];
  const rows = await db.select().from(authRateLimits).where(inArray(authRateLimits.key, keys));
  const cutoff = Date.now() - WINDOW_MS;
  return rows.some((row) => row.windowStartedAt.getTime() >= cutoff
    && row.failures >= (row.key === userKey ? MFA_USER_LIMIT : MFA_ADDRESS_LIMIT));
}

export async function recordFailedMfa(userId: number) {
  const { userKey, addressKey } = await mfaKeysFor(userId);
  await recordFailures(addressKey ? [userKey, addressKey] : [userKey]);
}

export async function clearSuccessfulMfa(userId: number) {
  const { userKey } = await mfaKeysFor(userId);
  await db.delete(authRateLimits).where(eq(authRateLimits.key, userKey));
}

export async function clearSuccessfulLogin(identifier: string) {
  const { identifierKey } = await keysFor(identifier);
  await db.delete(authRateLimits).where(eq(authRateLimits.key, identifierKey));
}
