"use server";

import { createHash, randomBytes } from "crypto";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLogs, emailVerificationTokens, manualUserVerificationTokens, userRegistrationRequests, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import {
  buildEmailVerificationEmail,
  buildRegistrationApprovedEmail,
  buildUserAccountVerificationEmail,
} from "@/lib/email-templates";
import { requireModuleFullAccess } from "@/lib/server-utils";

const SERVICE_DESK_EMAIL = "itservicedesk@seaoil.com.ph";

function registrationId(formData: FormData) {
  const id = Number(formData.get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
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

async function sendApprovalEmail(request: { fullName: string; email: string }) {
  const loginUrl = `${await applicationOrigin()}/login`;
  await sendEmail({
    to: request.email,
    ...buildRegistrationApprovedEmail({ fullName: request.fullName, loginUrl }),
  });
}

async function sendRejectionEmail(request: { fullName: string; email: string }, reason: string) {
  await sendEmail({
    to: request.email,
    subject: "SEAOIL Printer - Registration Request Rejected",
    text: [
      `Hello ${request.fullName},`,
      "Your registration request was not approved.",
      `Reason: ${reason}`,
      `For assistance or clarification, please email ${SERVICE_DESK_EMAIL}.`,
    ].join("\n\n"),
    html: `<p>Hello ${escapeHtml(request.fullName)},</p><p>Your registration request was not approved.</p><p><strong>Reason:</strong> ${escapeHtml(reason)}</p><p>For assistance or clarification, please email <a href="mailto:${SERVICE_DESK_EMAIL}">${SERVICE_DESK_EMAIL}</a>.</p>`,
  });
}

async function sendRegistrationVerificationEmail(request: {
  fullName: string;
  email: string;
  employeeId: string | null;
  source: string;
}, rawToken: string) {
  const manual = request.source === "manual";
  const verificationUrl = `${await applicationOrigin()}/${manual ? "verify-user-email" : "verify-email"}?token=${encodeURIComponent(rawToken)}`;
  const email = manual
    ? buildUserAccountVerificationEmail({
        fullName: request.fullName,
        employeeId: request.employeeId,
        verificationUrl,
      })
    : buildEmailVerificationEmail({
        fullName: request.fullName,
        employeeId: request.employeeId || "Not provided",
        verificationUrl,
      });
  await sendEmail({
    to: request.email,
    ...email,
  });
}

export async function resendRegistrationVerificationAction(formData: FormData) {
  await requireModuleFullAccess("registrations");
  const id = registrationId(formData);
  if (!id) redirect("/manage/registrations?error=Invalid registration request.");
  const returnPath = `/manage/registrations/${id}`;
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000);

  const request = await db.transaction(async (tx) => {
    const [registration] = await tx.select().from(userRegistrationRequests).where(and(
      eq(userRegistrationRequests.id, id),
      inArray(userRegistrationRequests.status, ["pending_email", "expired"]),
    )).limit(1);
    if (!registration) return null;

    if (registration.source === "manual") {
      if (!registration.userId) return null;
      const [pendingUser] = await tx.select({ id: users.id }).from(users).where(and(
        eq(users.id, registration.userId),
        eq(users.accountStatus, "pending_email"),
      )).limit(1);
      if (!pendingUser) return null;
      await tx.update(manualUserVerificationTokens).set({ consumedAt: now }).where(and(
        eq(manualUserVerificationTokens.userId, pendingUser.id),
        isNull(manualUserVerificationTokens.consumedAt),
      ));
      await tx.insert(manualUserVerificationTokens).values({
        userId: pendingUser.id,
        tokenHash,
        expiresAt,
      });
    } else {
      await tx.update(emailVerificationTokens).set({ consumedAt: now }).where(and(
        eq(emailVerificationTokens.registrationRequestId, registration.id),
        isNull(emailVerificationTokens.consumedAt),
      ));
      await tx.insert(emailVerificationTokens).values({
        registrationRequestId: registration.id,
        tokenHash,
        expiresAt,
        createdAt: now,
      });
    }

    await tx.update(userRegistrationRequests).set({
      status: "pending_email",
      expiresAt,
    }).where(eq(userRegistrationRequests.id, registration.id));
    return registration;
  });

  if (!request) redirect(`${returnPath}?error=Only registrations awaiting email verification can be resent.`);
  try {
    await sendRegistrationVerificationEmail(request, rawToken);
  } catch (error) {
    console.error("Registration verification resend failed:", error instanceof Error ? error.message : "UnknownError");
    redirect(`${returnPath}?error=The verification email could not be sent. Check the SMTP settings and try again.`);
  }
  revalidatePath("/manage/registrations");
  revalidatePath(returnPath);
  redirect(`${returnPath}?success=Previous verification links were expired and a new email was sent.`);
}

export async function approveRegistrationAction(formData: FormData) {
  const admin = await requireModuleFullAccess("registrations");
  const id = registrationId(formData);
  if (!id) redirect("/manage/registrations?error=Invalid registration request.");
  let approvedRequest: { fullName: string; email: string } | null = null;
  try {
    approvedRequest = await db.transaction(async (tx) => {
      const [request] = await tx.select().from(userRegistrationRequests).where(and(
        eq(userRegistrationRequests.id, id),
        inArray(userRegistrationRequests.status, ["pending_email", "pending_admin"]),
      )).limit(1);
      if (!request) throw new Error("RegistrationNotApprovable");
      const now = new Date();

      if (request.source === "manual") {
        if (!request.userId) throw new Error("ManualUserMissing");
        const activated = await tx.update(users).set({
          accountStatus: "active",
        }).where(and(
          eq(users.id, request.userId),
          eq(users.accountStatus, "pending_email"),
        )).returning({ id: users.id });
        if (!activated.length) throw new Error("ManualUserNotActivatable");
        await tx.update(manualUserVerificationTokens).set({ consumedAt: now }).where(and(
          eq(manualUserVerificationTokens.userId, request.userId),
          isNull(manualUserVerificationTokens.consumedAt),
        ));
      } else {
        if (!request.employeeId || !request.primaryLocationId || !request.departmentId) {
          throw new Error("EmployeeRegistrationIncomplete");
        }
        const [duplicate] = await tx.select({ id: users.id }).from(users).where(or(
          eq(users.employeeId, request.employeeId),
          eq(users.email, request.email),
          eq(users.username, request.username),
        )).limit(1);
        if (duplicate) throw new Error("RegistrationIdentityConflict");
        await tx.insert(users).values({
          fullName: request.fullName,
          employeeId: request.employeeId,
          email: request.email,
          username: request.username,
          passwordHash: request.passwordHash,
          primaryLocationId: request.primaryLocationId,
          departmentId: request.departmentId,
          subunitId: request.subunitId,
          costCenterId: request.costCenterId,
          role: "employee",
          accountStatus: "active",
          emailVerifiedAt: request.emailVerifiedAt,
        });
        await tx.update(emailVerificationTokens).set({ consumedAt: now }).where(and(
          eq(emailVerificationTokens.registrationRequestId, id),
          isNull(emailVerificationTokens.consumedAt),
        ));
      }

      const updated = await tx.update(userRegistrationRequests).set({
        status: "approved",
        reviewedBy: admin.id,
        reviewedAt: now,
        rejectionReason: null,
      }).where(and(
        eq(userRegistrationRequests.id, id),
        inArray(userRegistrationRequests.status, ["pending_email", "pending_admin"]),
      )).returning({ id: userRegistrationRequests.id });
      if (!updated.length) throw new Error("RegistrationChanged");
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "registration.approved",
        targetType: "registration",
        targetId: String(id),
        metadata: {
          employeeId: request.employeeId,
          source: request.source,
          bypassedEmailVerification: request.status === "pending_email",
        },
      });
      return { fullName: request.fullName, email: request.email };
    });
  } catch (error) {
    console.error("Registration approval failed:", error instanceof Error ? error.message : "UnknownError");
    redirect(`/manage/registrations/${id}?error=Registration could not be approved. Recheck its status and unique account fields.`);
  }

  let emailError = false;
  try {
    await sendApprovalEmail(approvedRequest);
  } catch (error) {
    emailError = true;
    console.error("Registration approval email failed:", error instanceof Error ? error.message : "UnknownError");
  }
  revalidatePath("/manage/registrations");
  revalidatePath("/manage");
  redirect(`/manage/registrations/${id}?success=Registration approved.${emailError ? "&error=The approval email could not be sent. Check the SMTP settings and notify the user manually." : ""}`);
}

export async function rejectRegistrationAction(formData: FormData) {
  const admin = await requireModuleFullAccess("registrations");
  const id = registrationId(formData);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!id) redirect("/manage/registrations?error=Invalid registration request.");
  if (reason.length < 3) redirect(`/manage/registrations/${id}?error=A rejection reason is required.`);
  const now = new Date();
  const rejectedRequest = await db.transaction(async (tx) => {
    const rows = await tx.update(userRegistrationRequests).set({ status: "rejected", reviewedBy: admin.id, reviewedAt: now, rejectionReason: reason }).where(and(
      eq(userRegistrationRequests.id, id),
      inArray(userRegistrationRequests.status, ["pending_email", "pending_admin"]),
    )).returning({
      id: userRegistrationRequests.id,
      fullName: userRegistrationRequests.fullName,
      email: userRegistrationRequests.email,
      source: userRegistrationRequests.source,
      userId: userRegistrationRequests.userId,
    });
    const rejected = rows[0];
    if (rejected) {
      await tx.update(emailVerificationTokens).set({ consumedAt: now }).where(eq(emailVerificationTokens.registrationRequestId, id));
      if (rejected.source === "manual" && rejected.userId) {
        await tx.update(manualUserVerificationTokens).set({ consumedAt: now }).where(and(
          eq(manualUserVerificationTokens.userId, rejected.userId),
          isNull(manualUserVerificationTokens.consumedAt),
        ));
        await tx.delete(users).where(and(
          eq(users.id, rejected.userId),
          eq(users.accountStatus, "pending_email"),
        ));
      }
      await tx.insert(auditLogs).values({
        actorUserId: admin.id,
        action: "registration.rejected",
        targetType: "registration",
        targetId: String(id),
        metadata: { reason, source: rejected.source },
      });
    }
    return rejected ?? null;
  });
  if (!rejectedRequest) redirect(`/manage/registrations/${id}?error=Only registrations awaiting verification or approval can be rejected.`);

  let emailError = false;
  try {
    await sendRejectionEmail(rejectedRequest, reason);
  } catch (error) {
    emailError = true;
    console.error("Registration rejection email failed:", error instanceof Error ? error.message : "UnknownError");
  }
  revalidatePath("/manage/registrations");
  revalidatePath("/manage");
  redirect(`/manage/registrations/${id}?success=Registration rejected.${emailError ? "&error=The rejection email could not be sent. Check the SMTP settings and notify the user manually." : ""}`);
}
