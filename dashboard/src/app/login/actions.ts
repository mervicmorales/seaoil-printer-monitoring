"use server";

import { db } from "@/db";
import { userRegistrationRequests, users } from "@/db/schema";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { clearMfaChallengeCookie, setMfaChallengeCookie, setSessionCookie, verifyPassword } from "@/lib/auth";
import { expireRegistrationRequests } from "@/lib/registration-requests";
import { isUserRole } from "@/lib/roles";
import { clearSuccessfulLogin, isLoginRateLimited, recordFailedLogin } from "@/lib/auth-rate-limit";
import { encryptMfaSecret, assertMfaConfiguration } from "@/lib/mfa-secrets";
import { generateTotpSecret } from "@/lib/totp";

export type LoginState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function safeRedirectPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return "/overview";
  }
  return value;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") || "").trim();
  const normalizedEmail = identifier.toLowerCase();
  const password = String(formData.get("password") || "");
  const requestedRedirect = safeRedirectPath(String(formData.get("next") || "/overview"));

  const fieldErrors: Record<string, string> = {};
  if (!identifier) fieldErrors.identifier = "Email or username is required.";
  if (!password) fieldErrors.password = "Password is required.";
  if (Object.keys(fieldErrors).length) {
    return { fieldErrors };
  }
  if (await isLoginRateLimited(identifier)) {
    return { error: "Too many sign-in attempts. Please try again in 15 minutes." };
  }

  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.username, identifier), eq(users.email, normalizedEmail)))
    .limit(1);

  const user = rows[0];
  if (!user) {
    await expireRegistrationRequests();
    const [registration] = await db
      .select({
        email: userRegistrationRequests.email,
        passwordHash: userRegistrationRequests.passwordHash,
        status: userRegistrationRequests.status,
      })
      .from(userRegistrationRequests)
      .where(and(
        or(
          eq(userRegistrationRequests.email, normalizedEmail),
          eq(userRegistrationRequests.username, identifier),
        ),
        inArray(userRegistrationRequests.status, ["pending_email", "pending_admin"]),
      ))
      .orderBy(desc(userRegistrationRequests.createdAt))
      .limit(1);

    if (registration && await verifyPassword(password, registration.passwordHash)) {
      if (registration.status === "pending_email") {
        return {
          error: `Please verify your email address using the verification link sent to ${registration.email} before signing in.`,
        };
      }
      if (registration.status === "pending_admin") {
        return {
          error: "Your account is currently undergoing administrator validation. If validation takes longer than 1 hour, please email itservicedesk@seaoil.com.ph.",
        };
      }
    }

    await recordFailedLogin(identifier);
    return { error: "Invalid credentials. Please check your email/username and password." };
  }
  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await recordFailedLogin(identifier);
    return { error: "Invalid credentials. Please check your email/username and password." };
  }
  if (user.accountStatus === "pending_email") {
    return {
      error: `Please verify your email address using the verification link sent to ${user.email} before signing in.`,
    };
  }
  if (user.accountStatus !== "active") {
    return { error: "This account is not active. Please contact IT support." };
  }
  if (!isUserRole(user.role)) {
    return { error: "This account has an invalid role. Please contact IT support." };
  }
  if (
    user.passwordChangeRequired
    && (!user.temporaryPasswordExpiresAt || user.temporaryPasswordExpiresAt.getTime() <= Date.now())
  ) {
    return { error: "This temporary password has expired. Please contact IT support for a new one." };
  }

  const redirectTo = user.role === "employee"
    ? "/portal"
    : user.role === "support"
      ? "/"
      : requestedRedirect === "/portal"
        ? "/overview"
        : requestedRedirect;
  const postLoginRedirect = user.passwordChangeRequired
    ? `/account/change-password?next=${encodeURIComponent(redirectTo)}`
    : redirectTo;

  const mfaEnabled = Boolean(user.totpEnabledAt && user.totpSecretEncrypted);
  const mfaRequired = user.role === "admin" || user.role === "super_admin";
  if (mfaEnabled || mfaRequired) {
    try {
      assertMfaConfiguration();
    } catch {
      return { error: "Authenticator security is not configured on the server. Please contact IT support." };
    }
    if (!mfaEnabled) {
      await db
        .update(users)
        .set({ totpPendingSecretEncrypted: encryptMfaSecret(generateTotpSecret()) })
        .where(eq(users.id, user.id));
    }
    await setMfaChallengeCookie({
      userId: user.id,
      sessionVersion: user.sessionVersion,
      role: user.role,
      loginIdentifier: identifier,
      redirectTo: postLoginRedirect,
      purpose: mfaEnabled ? "verify" : "enroll",
    });
    redirect(mfaEnabled ? "/login/authenticator" : "/login/authenticator/setup");
  }

  await clearSuccessfulLogin(identifier);
  await clearMfaChallengeCookie();

  await setSessionCookie({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    role: user.role,
    sessionVersion: user.sessionVersion,
  });

  redirect(postLoginRedirect);
}
