"use server";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLogs, manualUserVerificationTokens, userRegistrationRequests, users, userModuleAccess } from "@/db/schema";
import { eq, and, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { hashPassword, isValidEmail, isValidPassword, PASSWORD_RULE_TEXT } from "@/lib/auth";
import { MODULES, defaultAccessForRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}
function roleValue(value: FormDataEntryValue | null): "admin" | "support" | "employee" {
  const role = str(value);
  return role === "admin" || role === "employee" ? role : "support";
}

async function applicationOrigin() {
  const requestHeaders = await headers();
  return process.env.APP_BASE_URL?.replace(/\/$/, "")
    || requestHeaders.get("origin")
    || "http://localhost:3000";
}

function escapeHtml(input: string) {
  return input.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

async function sendManualUserVerificationEmail(user: { fullName: string; email: string }, rawToken: string) {
  const verificationUrl = `${await applicationOrigin()}/verify-user-email?token=${encodeURIComponent(rawToken)}`;
  await sendEmail({
    to: user.email,
    subject: "SEAOIL Printer - Verify Your User Account",
    text: [
      `Hello ${user.fullName},`,
      "A user account was created for you in SEAOIL Printer Monitoring.",
      "Verify your email using the link below to activate your account:",
      verificationUrl,
      "This single-use link expires in 24 hours. No additional administrator approval is required after verification.",
    ].join("\n\n"),
    html: `<p>Hello ${escapeHtml(user.fullName)},</p><p>A user account was created for you in SEAOIL Printer Monitoring.</p><p><a href="${escapeHtml(verificationUrl)}">Verify and activate your account</a></p><p>This single-use link expires in 24 hours. No additional administrator approval is required after verification.</p>`,
  });
}

export type UserFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  const creator = await requireModuleFullAccess("manage_users");
  const returnTo = formData.get("returnTo") === "/manage/registrations"
    ? "/manage/registrations"
    : "/manage";

  const fullName = str(formData.get("fullName"));
  const email = str(formData.get("email"));
  const username = str(formData.get("username"));
  const employeeId = str(formData.get("employeeId"))?.toUpperCase() ?? null;
  const primaryLocationId = num(formData.get("primaryLocationId"));
  const departmentId = num(formData.get("departmentId"));
  const password = String(formData.get("password") || "");
  const role = roleValue(formData.get("role"));

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Full Name is required.";
  if (!email) fieldErrors.email = "Email Address is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (!username) fieldErrors.username = "Username is required.";
  if (employeeId && !/^SPI[0-9]{5}$/.test(employeeId)) fieldErrors.employeeId = "Use the format SPI followed by five digits.";
  if (role === "employee" && !employeeId) fieldErrors.employeeId = "Employee ID is required for employees.";
  if (role === "employee" && !primaryLocationId) fieldErrors.primaryLocationId = "Location is required for employees.";
  if (role === "employee" && !departmentId) fieldErrors.departmentId = "Department is required for employees.";
  if (!password) fieldErrors.password = "Password is required.";
  else if (!isValidPassword(password)) fieldErrors.password = PASSWORD_RULE_TEXT;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000);
  let createdUser: { id: number; fullName: string; email: string };
  try {
    const passwordHash = await hashPassword(password);
    createdUser = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(users)
        .values({
          fullName: fullName!,
          email: email!,
          username: username!,
          passwordHash,
          role,
          employeeId,
          primaryLocationId,
          departmentId,
          accountStatus: "pending_email",
          emailVerifiedAt: null,
        })
        .returning({ id: users.id, fullName: users.fullName, email: users.email });

      const defaults = defaultAccessForRole(role);
      await tx.insert(userModuleAccess).values(MODULES.map((module) => ({
        userId: inserted.id,
        module,
        fullAccess: defaults[module],
      })));
      await tx.insert(manualUserVerificationTokens).values({
        userId: inserted.id,
        tokenHash,
        expiresAt,
      });
      await tx.insert(userRegistrationRequests).values({
        employeeId,
        fullName: fullName!,
        email: email!,
        username: username!,
        passwordHash,
        primaryLocationId,
        departmentId,
        source: "manual",
        userId: inserted.id,
        status: "pending_email",
        expiresAt,
        reviewedBy: creator.id,
        reviewedAt: new Date(),
      });
      return inserted;
    });
  } catch (err) {
    console.error(err);
    return { error: "Could not create user. Email, username, or Employee ID may already be in use." };
  }

  let emailError = false;
  try {
    await sendManualUserVerificationEmail(createdUser, rawToken);
  } catch (error) {
    emailError = true;
    console.error("Manual user verification email failed:", error instanceof Error ? error.message : "UnknownError");
  }
  revalidatePath("/manage");
  revalidatePath("/manage/registrations");
  redirect(`${returnTo}?success=User created and awaiting email verification.${emailError ? "&error=The verification email could not be sent. Use Resend Verification from the user's Registration Detail after checking SMTP settings." : ""}`);
}

export async function updateUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireModuleFullAccess("manage_users");

  const id = num(formData.get("id"));
  if (!id) return { error: "Invalid user." };

  const fullName = str(formData.get("fullName"));
  const email = str(formData.get("email"));
  const username = str(formData.get("username"));
  const employeeId = str(formData.get("employeeId"))?.toUpperCase() ?? null;
  const primaryLocationId = num(formData.get("primaryLocationId"));
  const departmentId = num(formData.get("departmentId"));
  const password = String(formData.get("password") || "");
  const role = roleValue(formData.get("role"));

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Full Name is required.";
  if (!email) fieldErrors.email = "Email Address is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (!username) fieldErrors.username = "Username is required.";
  if (employeeId && !/^SPI[0-9]{5}$/.test(employeeId)) fieldErrors.employeeId = "Use the format SPI followed by five digits.";
  if (role === "employee" && !employeeId) fieldErrors.employeeId = "Employee ID is required for employees.";
  if (role === "employee" && !primaryLocationId) fieldErrors.primaryLocationId = "Location is required for employees.";
  if (role === "employee" && !departmentId) fieldErrors.departmentId = "Department is required for employees.";
  if (password && !isValidPassword(password)) fieldErrors.password = PASSWORD_RULE_TEXT;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const updateValues: Record<string, unknown> = {
      fullName,
      email,
      username,
      role,
      employeeId,
      primaryLocationId,
      departmentId,
    };
    if (password) updateValues.passwordHash = await hashPassword(password);
    await db.update(users).set(updateValues).where(eq(users.id, id));
  } catch (err) {
    console.error(err);
    return { error: "Could not update user. Email, username, or Employee ID may already be in use." };
  }

  revalidatePath("/manage");
  redirect("/manage?success=User updated successfully.");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireModuleFullAccess("manage_users");
  const id = num(formData.get("id"));
  if (!id || id === admin.id) {
    redirect("/manage?success=Cannot delete this account.");
  }
  const deletionReason = str(formData.get("deletionReason"));
  if (!deletionReason || deletionReason.length < 3) {
    redirect("/manage?error=A deletion reason of at least 3 characters is required.");
  }
  try {
    await db.transaction(async (tx) => {
      const [target] = await tx.select({
        id: users.id,
        employeeId: users.employeeId,
        email: users.email,
        username: users.username,
      }).from(users).where(eq(users.id, id!)).limit(1);
      if (!target) throw new Error("UserNotFound");

      await tx.update(userRegistrationRequests).set({
        status: "account_deleted",
        deletionReason,
      }).where(or(
        eq(userRegistrationRequests.userId, target.id),
        and(
          eq(userRegistrationRequests.status, "approved"),
          or(
            eq(userRegistrationRequests.email, target.email),
            eq(userRegistrationRequests.username, target.username),
          ),
        ),
      ));
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "user.deleted",
        targetType: "user",
        targetId: String(target.id),
        metadata: { email: target.email, employeeId: target.employeeId, deletionReason },
      });
      await tx.delete(users).where(eq(users.id, target.id));
    });
  } catch (error) {
    console.error("User deletion failed:", error instanceof Error ? error.message : "UnknownError");
    redirect("/manage?error=The user could not be deleted. Apply the latest database migration and try again.");
  }
  revalidatePath("/manage");
  revalidatePath("/manage/registrations");
  redirect("/manage?success=User deleted. Registration history was preserved.");
}

export async function updatePermissionsAction(formData: FormData) {
  await requireModuleFullAccess("manage_users");
  const userId = num(formData.get("userId"));
  if (!userId) return;

  for (const mod of MODULES) {
    const fullAccess = formData.get(`module_${mod}`) === "on";
    await db
      .insert(userModuleAccess)
      .values({ userId, module: mod, fullAccess })
      .onConflictDoUpdate({ target: [userModuleAccess.userId, userModuleAccess.module], set: { fullAccess } });
  }

  revalidatePath("/manage");
  redirect("/manage?success=Permissions updated.");
}
