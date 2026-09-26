import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/validation";
import { isUserRole, type UserRole } from "@/lib/roles";

export { SESSION_COOKIE };
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
    return jwt.verify(token, secret) as SessionPayload;
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
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!account || !isUserRole(account.role) || account.accountStatus !== "active") return null;
  if ((session.sessionVersion ?? 0) !== account.sessionVersion) return null;

  return {
    ...account,
    role: account.role,
  };
}

export async function setSessionCookie(payload: SessionPayload) {
  const [store, requestHeaders] = await Promise.all([cookies(), headers()]);
  const forwardedProtocol = requestHeaders
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  const requestOrigin = requestHeaders.get("origin")?.trim().toLowerCase();
  const secure = forwardedProtocol
    ? forwardedProtocol === "https"
    : requestOrigin?.startsWith("https://") ?? false;

  store.set(SESSION_COOKIE, signSession(payload), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export { PASSWORD_RULE_TEXT, isValidPassword, isValidEmail } from "@/lib/validation";
