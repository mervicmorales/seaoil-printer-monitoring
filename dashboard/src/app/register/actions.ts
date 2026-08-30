"use server";

import { createHash, randomBytes } from "crypto";
import { and, desc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { departments, emailVerificationTokens, locations, systemSettings, userRegistrationRequests, users } from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { isValidPassword, PASSWORD_RULE_TEXT } from "@/lib/validation";
import { expireRegistrationRequests } from "@/lib/registration-requests";

export type RegistrationState = {
  success?: string;
  error?: string;
  fieldErrors?: Record<string, string>;
  cooldownUntil?: number;
};
const genericSuccess = "If the submitted details are eligible, a verification email will arrive shortly.";
const RESEND_COOLDOWN_MS = 15 * 60_000;

function genericCooldownSuccess(cooldownUntil = Date.now() + RESEND_COOLDOWN_MS): RegistrationState {
  return { success: genericSuccess, cooldownUntil };
}

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function verificationOrigin() {
  const requestHeaders = await headers();
  return process.env.APP_BASE_URL?.replace(/\/$/, "") || requestHeaders.get("origin") || "http://localhost:3000";
}

async function sendVerificationEmail(request: { fullName: string; employeeId: string; email: string }, rawToken: string) {
  const verificationUrl = `${await verificationOrigin()}/verify-email?token=${encodeURIComponent(rawToken)}`;
  await sendEmail({
    to: request.email,
    subject: "SEAOIL Printer - Verify Your Email",
    text: [`Hello ${request.fullName},`, `Employee ID: ${request.employeeId}`, "Verify your email using this link:", verificationUrl, "This single-use link expires in 24 hours."].join("\n\n"),
    html: `<p>Hello ${escapeHtml(request.fullName)},</p><p>Employee ID: ${escapeHtml(request.employeeId)}</p><p><a href="${escapeHtml(verificationUrl)}">Verify your email</a></p><p>This single-use link expires in 24 hours.</p>`,
  });
}

export async function registerAction(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  await expireRegistrationRequests();
  const fullName = value(formData, "fullName").replace(/\s+/g, " ");
  const employeeId = value(formData, "employeeId").toUpperCase();
  const email = value(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const primaryLocationId = Number(value(formData, "primaryLocationId"));
  const departmentId = Number(value(formData, "departmentId"));
  const username = email.split("@")[0];
  const fieldErrors: Record<string, string> = {};
  if (fullName.length < 2) fieldErrors.fullName = "Full name is required.";
  if (!/^SPI[0-9]{5}$/.test(employeeId)) fieldErrors.employeeId = "Use the format SPI followed by five digits.";
  if (!/^[^\s@]+@seaoil\.com\.ph$/i.test(email)) fieldErrors.email = "Use your @seaoil.com.ph email address.";
  if (!isValidPassword(password)) fieldErrors.password = PASSWORD_RULE_TEXT;
  if (password !== confirmPassword) fieldErrors.confirmPassword = "Passwords do not match.";
  if (!Number.isInteger(primaryLocationId) || primaryLocationId < 1) fieldErrors.primaryLocationId = "Select a location.";
  if (!Number.isInteger(departmentId) || departmentId < 1) fieldErrors.departmentId = "Select a department.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const [[settings], [location], [department]] = await Promise.all([
    db.select({ enabled: systemSettings.registrationEnabled }).from(systemSettings).limit(1),
    db.select({ id: locations.id }).from(locations).where(eq(locations.id, primaryLocationId)).limit(1),
    db.select({ id: departments.id }).from(departments).where(eq(departments.id, departmentId)).limit(1),
  ]);
  if (settings?.enabled === false) return { error: "Employee registration is currently unavailable." };
  if (!location) fieldErrors.primaryLocationId = "Select a valid location.";
  if (!department) fieldErrors.departmentId = "Select a valid department.";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const recentCutoff = new Date(Date.now() - 15 * 60_000);
  const [existingUser, existingRequest, recentRequest] = await Promise.all([
    db.select({ id: users.id }).from(users).where(or(eq(users.email, email), eq(users.employeeId, employeeId), eq(users.username, username))).limit(1),
    db.select({ id: userRegistrationRequests.id }).from(userRegistrationRequests).where(and(
      or(eq(userRegistrationRequests.email, email), eq(userRegistrationRequests.employeeId, employeeId), eq(userRegistrationRequests.username, username)),
      inArray(userRegistrationRequests.status, ["pending_email", "pending_admin", "approved"]),
    )).limit(1),
    db.select({ id: userRegistrationRequests.id }).from(userRegistrationRequests).where(and(
      eq(userRegistrationRequests.email, email),
      gt(userRegistrationRequests.createdAt, recentCutoff),
    )).limit(1),
  ]);
  if (existingUser.length || existingRequest.length || recentRequest.length) return { success: genericSuccess };

  const tokenCreatedAt = new Date();
  const cooldownUntil = tokenCreatedAt.getTime() + RESEND_COOLDOWN_MS;
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
  const passwordHash = await hashPassword(password);
  const [request] = await db.transaction(async (tx) => {
    const inserted = await tx.insert(userRegistrationRequests).values({
      fullName,
      employeeId,
      email,
      username,
      passwordHash,
      primaryLocationId,
      departmentId,
      status: "pending_email",
      expiresAt,
    }).returning();
    await tx.update(emailVerificationTokens).set({ consumedAt: new Date() }).where(and(
      eq(emailVerificationTokens.registrationRequestId, inserted[0].id),
      isNull(emailVerificationTokens.consumedAt),
    ));
    await tx.insert(emailVerificationTokens).values({
      registrationRequestId: inserted[0].id,
      tokenHash,
      expiresAt,
      createdAt: tokenCreatedAt,
    });
    return inserted;
  });

  try {
    await sendVerificationEmail(request, rawToken);
  } catch (error) {
    console.error("Registration verification email failed:", error instanceof Error ? error.name : "UnknownError");
    return {
      error: "Registration was saved, but the verification email could not be sent. Please contact IT support.",
      cooldownUntil,
    };
  }
  return genericCooldownSuccess(cooldownUntil);
}

export async function resendVerificationAction(_previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  await expireRegistrationRequests();
  const email = value(formData, "email").toLowerCase();
  if (!/^[^\s@]+@seaoil\.com\.ph$/i.test(email)) return genericCooldownSuccess();
  const [request] = await db.select().from(userRegistrationRequests).where(and(eq(userRegistrationRequests.email, email), eq(userRegistrationRequests.status, "pending_email"))).limit(1);
  if (!request) return genericCooldownSuccess();
  const [latest] = await db.select({ createdAt: emailVerificationTokens.createdAt }).from(emailVerificationTokens).where(eq(emailVerificationTokens.registrationRequestId, request.id)).orderBy(desc(emailVerificationTokens.createdAt)).limit(1);
  if (latest && latest.createdAt > new Date(Date.now() - RESEND_COOLDOWN_MS)) {
    return genericCooldownSuccess(latest.createdAt.getTime() + RESEND_COOLDOWN_MS);
  }
  const tokenCreatedAt = new Date();
  const cooldownUntil = tokenCreatedAt.getTime() + RESEND_COOLDOWN_MS;
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
  await db.transaction(async (tx) => {
    await tx.update(emailVerificationTokens).set({ consumedAt: new Date() }).where(and(eq(emailVerificationTokens.registrationRequestId, request.id), isNull(emailVerificationTokens.consumedAt)));
    await tx.insert(emailVerificationTokens).values({
      registrationRequestId: request.id,
      tokenHash,
      expiresAt,
      createdAt: tokenCreatedAt,
    });
    await tx.update(userRegistrationRequests).set({ expiresAt }).where(eq(userRegistrationRequests.id, request.id));
  });
  try {
    await sendVerificationEmail(request, rawToken);
  } catch (error) {
    console.error("Registration verification resend failed:", error instanceof Error ? error.name : "UnknownError");
  }
  return genericCooldownSuccess(cooldownUntil);
}

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}
