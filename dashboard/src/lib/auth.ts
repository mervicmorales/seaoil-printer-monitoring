import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/validation";
import { isUserRole, type UserRole } from "@/lib/roles";

export { SESSION_COOKIE };
export const MFA_CHALLENGE_COOKIE = "seaoil_mfa_challenge";
function sessionSecret() {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret || secret.length < 32 || /^(change_me|replace-with-)/i.test(secret) || secret === "seaoil-printer-monitoring-dev-secret") {
    throw new Error("AUTH_SECRET must be a unique secret of at least 32 characters");
  }
  return secret;
}

export function assertAuthConfiguration() {
  sessionSecret();
}

export type SessionPayload = {
  id: number;
  fullName: string;
  email: string;
  username: string;
  role: UserRole;
  sessionVersion: number;
};

export type MfaChallengePayload = {
  kind: "mfa_challenge";
  userId: number;
  sessionVersion: number;
  role: UserRole;
  loginIdentifier: string;
  redirectTo: string;
  purpose: "verify" | "enroll";
};

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, sessionSecret(), { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload | null {
  const secret = sessionSecret();
  try {
    const value = jwt.verify(token, secret) as Partial<SessionPayload> & { kind?: string };
    if (
      value.kind === "mfa_challenge"
      || !Number.isInteger(value.id)
      || typeof value.fullName !== "string"
      || typeof value.email !== "string"
      || typeof value.username !== "string"
      || typeof value.role !== "string"
      || !isUserRole(value.role)
      || !Number.isInteger(value.sessionVersion)
    ) return null;
    return value as SessionPayload;
  } catch {
    return null;
  }
}

export function signMfaChallenge(payload: Omit<MfaChallengePayload, "kind">) {
  return jwt.sign(
    { ...payload, kind: "mfa_challenge" },
    sessionSecret(),
    {
      algorithm: "HS256",
      expiresIn: "10m",
      audience: "sea-print-mfa",
      issuer: "sea-print",
    },
  );
}

export function verifyMfaChallenge(token: string): MfaChallengePayload | null {
  try {
    const value = jwt.verify(token, sessionSecret(), {
      algorithms: ["HS256"],
      audience: "sea-print-mfa",
      issuer: "sea-print",
    }) as Partial<MfaChallengePayload>;
    if (
      value.kind !== "mfa_challenge"
      || !Number.isInteger(value.userId)
      || !Number.isInteger(value.sessionVersion)
      || typeof value.role !== "string"
      || !isUserRole(value.role)
      || typeof value.loginIdentifier !== "string"
      || typeof value.redirectTo !== "string"
      || (value.purpose !== "verify" && value.purpose !== "enroll")
    ) return null;
    return value as MfaChallengePayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = verifySession(token);
  if (!session) return null;

  const [account] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      username: users.username,
      role: users.role,
      accountStatus: users.accountStatus,
      sessionVersion: users.sessionVersion,
      totpEnabledAt: users.totpEnabledAt,
      totpSecretEncrypted: users.totpSecretEncrypted,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!account || !isUserRole(account.role) || account.accountStatus !== "active") return null;
  if ((session.sessionVersion ?? 0) !== account.sessionVersion) return null;
  if (
    (account.role === "admin" || account.role === "super_admin")
    && (!account.totpEnabledAt || !account.totpSecretEncrypted)
  ) return null;

  return {
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    username: account.username,
    role: account.role,
    sessionVersion: account.sessionVersion,
  };
}

export async function setSessionCookie(payload: SessionPayload) {
  const store = await cookies();
  const secure = await requestUsesHttps();
  store.set(SESSION_COOKIE, signSession(payload), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

async function requestUsesHttps() {
  const requestHeaders = await headers();
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const requestOrigin = requestHeaders.get("origin")?.trim().toLowerCase();
  return forwardedProtocol
    ? forwardedProtocol === "https"
    : requestOrigin?.startsWith("https://") ?? false;
}

export async function setMfaChallengeCookie(payload: Omit<MfaChallengePayload, "kind">) {
  const store = await cookies();
  store.set(MFA_CHALLENGE_COOKIE, signMfaChallenge(payload), {
    httpOnly: true,
    secure: await requestUsesHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: 10 * 60,
  });
}

export async function getMfaChallenge() {
  const store = await cookies();
  const token = store.get(MFA_CHALLENGE_COOKIE)?.value;
  return token ? verifyMfaChallenge(token) : null;
}

export async function clearMfaChallengeCookie() {
  const store = await cookies();
  store.delete(MFA_CHALLENGE_COOKIE);
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export { PASSWORD_RULE_TEXT, isValidPassword, isValidEmail } from "@/lib/validation";
