"use server";

import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  auditLogs,
  manualUserVerificationTokens,
  monitoringAgentLocations,
  monitoringAgents,
  passwordResetTokens,
  printerAccessRequests,
  printerMonitoringAssignments,
  printers,
  printOpsCommands,
  userPrinterPermissions,
  userRegistrationRequests,
  users,
  userModuleAccess,
} from "@/db/schema";
import { eq, and, inArray, isNotNull, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin, requireModuleFullAccess } from "@/lib/server-utils";
import { hashPassword, isValidEmail, isValidPassword, PASSWORD_RULE_TEXT } from "@/lib/auth";
import { EMPLOYEE_ID_RULE_TEXT, isValidEmployeeId } from "@/lib/validation";
import { MODULES, MODULE_PARENTS, defaultAccessForRole } from "@/lib/permissions";
import { sendEmail } from "@/lib/email";
import { buildPasswordResetEmail, buildUserAccountVerificationEmail } from "@/lib/email-templates";
import { canManageRole, hasAdminPrivileges, isSuperAdmin, type UserRole } from "@/lib/roles";
import type { PrinterPermissionState } from "./PrinterPermissionsPanel";

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
function roleValue(value: FormDataEntryValue | null): UserRole {
  const role = str(value);
  return role === "super_admin" || role === "admin" || role === "employee" ? role : "support";
}

async function applicationOrigin() {
  const requestHeaders = await headers();
  return process.env.APP_BASE_URL?.replace(/\/$/, "")
    || requestHeaders.get("origin")
    || "http://localhost:3000";
}

async function sendManualUserVerificationEmail(user: { fullName: string; email: string }, rawToken: string) {
  const verificationUrl = `${await applicationOrigin()}/verify-user-email?token=${encodeURIComponent(rawToken)}`;
  await sendEmail({
    to: user.email,
    ...buildUserAccountVerificationEmail({
      fullName: user.fullName,
      verificationUrl,
    }),
  });
}

async function sendManagedPasswordResetEmail(user: { fullName: string; email: string }, rawToken: string) {
  const resetUrl = `${await applicationOrigin()}/reset-password?token=${encodeURIComponent(rawToken)}`;
  await sendEmail({
    to: user.email,
    ...buildPasswordResetEmail({
      fullName: user.fullName,
      resetUrl,
      requestedByIt: true,
    }),
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
  if (creator.role === "support" && role !== "employee") {
    fieldErrors.role = "Support users can only create Employee accounts.";
  }
  if (!isSuperAdmin(creator.role) && (role === "super_admin" || role === "admin")) {
    fieldErrors.role = "Only a Super Admin can create Admin or Super Admin accounts.";
  }
  if (!fullName) fieldErrors.fullName = "Full Name is required.";
  if (!email) fieldErrors.email = "Email Address is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (!username) fieldErrors.username = "Username is required.";
  if (employeeId && !isValidEmployeeId(employeeId)) fieldErrors.employeeId = EMPLOYEE_ID_RULE_TEXT;
  if (role === "employee" && !employeeId) fieldErrors.employeeId = "Employee ID is required for employees.";
  if ((role === "employee" || role === "support") && !primaryLocationId) fieldErrors.primaryLocationId = "Location is required for Employee and Support accounts.";
  if ((role === "employee" || role === "support") && !departmentId) fieldErrors.departmentId = "Department is required for Employee and Support accounts.";
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
  const actor = await requireAdmin("manage_users");

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

  const [target] = await db.select({
    role: users.role,
    primaryLocationId: users.primaryLocationId,
    departmentId: users.departmentId,
  }).from(users).where(eq(users.id, id)).limit(1);
  if (!target) return { error: "User not found." };
  if (!canManageRole(actor.role, target.role)) {
    return { error: "You cannot modify an account at or above your role level." };
  }
  if (!isSuperAdmin(actor.role) && (role === "super_admin" || role === "admin")) {
    return { error: "Only a Super Admin can assign Admin or Super Admin roles." };
  }

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Full Name is required.";
  if (!email) fieldErrors.email = "Email Address is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (!username) fieldErrors.username = "Username is required.";
  if (employeeId && !isValidEmployeeId(employeeId)) fieldErrors.employeeId = EMPLOYEE_ID_RULE_TEXT;
  if (role === "employee" && !employeeId) fieldErrors.employeeId = "Employee ID is required for employees.";
  if ((role === "employee" || role === "support") && !primaryLocationId) fieldErrors.primaryLocationId = "Location is required for Employee and Support accounts.";
  if ((role === "employee" || role === "support") && !departmentId) fieldErrors.departmentId = "Department is required for Employee and Support accounts.";
  if (password && !isValidPassword(password)) fieldErrors.password = PASSWORD_RULE_TEXT;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const assignmentChanged = (
    target.primaryLocationId !== primaryLocationId ||
    target.departmentId !== departmentId
  );

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
    await db.transaction(async (tx) => {
      await tx.update(users).set(updateValues).where(eq(users.id, id));

      if (role !== "employee" && role !== "support") {
        await tx
          .delete(userPrinterPermissions)
          .where(eq(userPrinterPermissions.userId, id));
        await tx
          .delete(printerAccessRequests)
          .where(eq(printerAccessRequests.userId, id));
        return;
      }
      if (!assignmentChanged) return;

      if (target.primaryLocationId !== primaryLocationId) {
        await tx
          .delete(userPrinterPermissions)
          .where(eq(userPrinterPermissions.userId, id));
        await tx
          .delete(printerAccessRequests)
          .where(eq(printerAccessRequests.userId, id));
        return;
      }

      const reassignedDepartmentIds = Array.from(new Set(
        [target.departmentId, departmentId].filter((value): value is number => value !== null),
      ));
      if (reassignedDepartmentIds.length === 0) return;
      const reassignedPrinters = await tx
        .select({ id: printers.id })
        .from(printers)
        .where(inArray(printers.departmentId, reassignedDepartmentIds));
      if (reassignedPrinters.length === 0) return;
      await tx
        .delete(userPrinterPermissions)
        .where(and(
          eq(userPrinterPermissions.userId, id),
          inArray(
            userPrinterPermissions.printerId,
            reassignedPrinters.map((printer) => printer.id),
          ),
        ));
    });
  } catch (err) {
    console.error(err);
    return { error: "Could not update user. Email, username, or Employee ID may already be in use." };
  }

  revalidatePath("/manage");
  revalidatePath(`/manage/${id}`);
  revalidatePath("/portal");
  revalidatePath("/portal/print");
  revalidatePath("/portal/scan");
  revalidatePath("/printops/available");
  revalidatePath("/printops/print");
  revalidatePath("/printops/scan");
  redirect(`/manage?success=${encodeURIComponent(
    assignmentChanged
      ? "User updated. Printer access was recalculated for the new assignment."
      : "User updated successfully.",
  )}`);
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin("manage_users");
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
        role: users.role,
      }).from(users).where(eq(users.id, id!)).limit(1);
      if (!target) throw new Error("UserNotFound");
      if (!canManageRole(admin.role, target.role)) throw new Error("InsufficientRoleHierarchy");

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

export async function sendEmployeePasswordResetAction(formData: FormData) {
  const actor = await requireModuleFullAccess("manage_users");
  if (actor.role !== "support" && !hasAdminPrivileges(actor.role)) redirect("/access-denied");

  const userId = num(formData.get("id"));
  if (!userId) redirect("/manage?error=Invalid user account.");
  const returnPath = `/manage/${userId}`;
  const [employee] = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      accountStatus: users.accountStatus,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!employee || employee.role !== "employee" || employee.accountStatus !== "active") {
    redirect(`${returnPath}?error=${encodeURIComponent("Password reset emails can only be sent to active Employee accounts.")}`);
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60_000);
  const [createdToken] = await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ consumedAt: now })
      .where(and(
        eq(passwordResetTokens.userId, employee.id),
        isNull(passwordResetTokens.consumedAt),
      ));
    const inserted = await tx
      .insert(passwordResetTokens)
      .values({ userId: employee.id, tokenHash, expiresAt })
      .returning({ id: passwordResetTokens.id });
    await tx.insert(auditLogs).values({
      actorUserId: actor.id,
      action: "account.password_reset_requested",
      targetType: "user",
      targetId: String(employee.id),
      metadata: { email: employee.email },
    });
    return inserted;
  });

  try {
    await sendManagedPasswordResetEmail(employee, rawToken);
  } catch (error) {
    console.error("Managed password reset email failed:", error instanceof Error ? error.message : "UnknownError");
    if (createdToken) {
      await db
        .update(passwordResetTokens)
        .set({ consumedAt: new Date() })
        .where(eq(passwordResetTokens.id, createdToken.id));
    }
    redirect(`${returnPath}?error=${encodeURIComponent("The password reset email could not be sent. Check the SMTP settings and try again.")}`);
  }

  revalidatePath(returnPath);
  redirect(`${returnPath}?success=${encodeURIComponent(`A password reset link was sent to ${employee.email}.`)}`);
}

export async function updatePermissionsAction(formData: FormData) {
  const actor = await requireAdmin("manage_users");
  const userId = num(formData.get("userId"));
  if (!userId) return;

  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return;
  if (!canManageRole(actor.role, target.role)) redirect("/access-denied");

  const requestedAccess = Object.fromEntries(
    MODULES.map((module) => [module, formData.get(`module_${module}`) === "on"]),
  ) as Record<(typeof MODULES)[number], boolean>;

  for (const [child, parent] of Object.entries(MODULE_PARENTS) as [
    (typeof MODULES)[number],
    (typeof MODULES)[number],
  ][]) {
    if (!requestedAccess[parent]) requestedAccess[child] = false;
  }

  await db.transaction(async (tx) => {
    for (const moduleName of MODULES) {
      await tx
        .insert(userModuleAccess)
        .values({ userId, module: moduleName, fullAccess: requestedAccess[moduleName] })
        .onConflictDoUpdate({
          target: [userModuleAccess.userId, userModuleAccess.module],
          set: { fullAccess: requestedAccess[moduleName] },
        });
    }
  });

  revalidatePath("/manage");
  redirect("/manage?success=Permissions updated.");
}

async function requirePrinterPermissionActor() {
  const actor = await requireModuleFullAccess("manage_users");
  if (actor.role !== "support" && !hasAdminPrivileges(actor.role)) {
    redirect("/access-denied");
  }
  return actor;
}

async function getPrinterPermissionAccount(userId: number, actorRole: UserRole) {
  const [account] = await db
    .select({
      id: users.id,
      role: users.role,
      locationId: users.primaryLocationId,
      departmentId: users.departmentId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!account || (account.role !== "employee" && account.role !== "support")) {
    throw new Error("Printer permissions can only be configured for Employee or Support accounts.");
  }
  if (account.role === "support" && !hasAdminPrivileges(actorRole)) {
    throw new Error("Only an Admin or Super Admin can configure Support printer permissions.");
  }
  if (!account.locationId) {
    throw new Error("Assign a location to this account before configuring printer permissions.");
  }
  if (!account.departmentId) {
    throw new Error("Assign a department to this account before configuring printer permissions.");
  }
  return account;
}

async function validatePermissionAgent(agentId: number, locationId: number) {
  const [agent] = await db
    .select({ id: monitoringAgents.id })
    .from(monitoringAgents)
    .leftJoin(
      monitoringAgentLocations,
      eq(monitoringAgentLocations.agentId, monitoringAgents.id),
    )
    .where(and(
      eq(monitoringAgents.id, agentId),
      or(
        eq(monitoringAgents.locationId, locationId),
        eq(monitoringAgentLocations.locationId, locationId),
      ),
      isNotNull(monitoringAgents.tokenHash),
      isNull(monitoringAgents.tokenRevokedAt),
    ))
    .limit(1);
  if (!agent) throw new Error("The selected agent is not available at this account's location.");
  return agent;
}

export async function refreshPrinterPermissionAgentAction(
  _state: PrinterPermissionState,
  formData: FormData,
): Promise<PrinterPermissionState> {
  const userId = num(formData.get("userId"));
  const agentId = num(formData.get("agentId"));
  if (!userId || !agentId) return { error: "Select an available agent." };
  const actor = await requirePrinterPermissionActor();

  try {
    const account = await getPrinterPermissionAccount(userId, actor.role);
    await validatePermissionAgent(agentId, account.locationId!);
    const [active] = await db
      .select({ id: printOpsCommands.id })
      .from(printOpsCommands)
      .where(and(
        eq(printOpsCommands.agentId, agentId),
        eq(printOpsCommands.type, "sync"),
        inArray(printOpsCommands.status, ["queued", "running"]),
      ))
      .limit(1);
    if (!active) {
      await db.insert(printOpsCommands).values({
        agentId,
        requestedBy: actor.id,
        type: "sync",
      });
    }
    revalidatePath(`/manage/${userId}`);
    return {
      success: active ? "Agent refresh is already in progress." : "Agent refresh queued. Printer data will update automatically.",
      refreshQueuedAt: Date.now(),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not refresh the agent." };
  }
}

export async function updatePrinterPermissionsAction(
  _state: PrinterPermissionState,
  formData: FormData,
): Promise<PrinterPermissionState> {
  const userId = num(formData.get("userId"));
  const agentId = num(formData.get("agentId"));
  if (!userId || !agentId) return { error: "Select an available agent." };
  const requestedPrinterIds = Array.from(new Set(
    formData.getAll("printerId")
      .map((value) => Number(String(value)))
      .filter((value) => Number.isSafeInteger(value) && value > 0),
  ));
  const actor = await requirePrinterPermissionActor();

  try {
    const account = await getPrinterPermissionAccount(userId, actor.role);
    await validatePermissionAgent(agentId, account.locationId!);
    const validPrinters = requestedPrinterIds.length === 0
      ? []
      : await db
          .select({
            id: printers.id,
            departmentId: printers.departmentId,
            locationId: printers.locationId,
          })
          .from(printers)
          .innerJoin(
            printerMonitoringAssignments,
            eq(printerMonitoringAssignments.printerId, printers.id),
          )
          .where(and(
            inArray(printers.id, requestedPrinterIds),
            eq(printers.status, "Active"),
            eq(printerMonitoringAssignments.agentId, agentId),
          ));
    if (validPrinters.length !== requestedPrinterIds.length) {
      return { error: "One or more selected printers are no longer available for this account." };
    }
    const additionalPrinters = validPrinters.filter(
      (printer) => (
        printer.locationId !== account.locationId ||
        printer.departmentId !== account.departmentId
      ),
    );

    await db.transaction(async (tx) => {
      await tx
        .delete(userPrinterPermissions)
        .where(and(
          eq(userPrinterPermissions.userId, userId),
          eq(userPrinterPermissions.agentId, agentId),
        ));
      if (additionalPrinters.length > 0) {
        for (const printer of additionalPrinters) {
          await tx
            .insert(userPrinterPermissions)
            .values({ userId, agentId, printerId: printer.id })
            .onConflictDoUpdate({
              target: [userPrinterPermissions.userId, userPrinterPermissions.printerId],
              set: { agentId },
            });
        }
        await tx
          .update(printerAccessRequests)
          .set({
            status: "approved",
            reviewedBy: actor.id,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(and(
            eq(printerAccessRequests.userId, userId),
            eq(printerAccessRequests.status, "pending"),
            inArray(
              printerAccessRequests.printerId,
              additionalPrinters.map((printer) => printer.id),
            ),
          ));
      }
      await tx.insert(auditLogs).values({
        actorUserId: actor.id,
        action: "user.printer_permissions_updated",
        targetType: "user",
        targetId: String(userId),
        metadata: {
          targetRole: account.role,
          agentId,
          printerIds: additionalPrinters.map((printer) => printer.id),
        },
      });
    });
    revalidatePath(`/manage/${userId}`);
    revalidatePath(`/manage/users/${userId}`);
    revalidatePath("/portal");
    revalidatePath("/portal/print");
    revalidatePath("/portal/scan");
    revalidatePath("/printops/available");
    revalidatePath("/printops/print");
    revalidatePath("/printops/scan");
    return {
      success: "Printer permissions updated.",
      savedPrinterIds: additionalPrinters.map((printer) => printer.id),
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update printer permissions." };
  }
}
