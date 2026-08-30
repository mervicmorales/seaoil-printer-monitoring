"use server";

import { and, eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { auditLogs, emailVerificationTokens, userRegistrationRequests, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
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
    subject: "SEAOIL Printer - Registration Approved",
    text: [
      `Hello ${request.fullName},`,
      "Your registration has been approved successfully. You can now sign in using the link below:",
      loginUrl,
    ].join("\n\n"),
    html: `<p>Hello ${escapeHtml(request.fullName)},</p><p>Your registration has been approved successfully. You can now sign in using the link below:</p><p><a href="${escapeHtml(loginUrl)}">Sign in to SEAOIL Printer Monitoring</a></p>`,
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

export async function approveRegistrationAction(formData: FormData) {
  const admin = await requireModuleFullAccess("registrations");
  const id = registrationId(formData);
  if (!id) redirect("/manage/registrations?error=Invalid registration request.");
  let approvedRequest: { fullName: string; email: string } | null = null;
  try {
    approvedRequest = await db.transaction(async (tx) => {
      const [request] = await tx.select().from(userRegistrationRequests).where(and(
        eq(userRegistrationRequests.id, id),
        eq(userRegistrationRequests.status, "pending_admin"),
      )).limit(1);
      if (!request || !request.emailVerifiedAt) throw new Error("RegistrationNotApprovable");
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
        role: "employee",
        accountStatus: "active",
        emailVerifiedAt: request.emailVerifiedAt,
      });
      const now = new Date();
      const updated = await tx.update(userRegistrationRequests).set({ status: "approved", reviewedBy: admin.id, reviewedAt: now, rejectionReason: null }).where(and(
        eq(userRegistrationRequests.id, id),
        eq(userRegistrationRequests.status, "pending_admin"),
      )).returning({ id: userRegistrationRequests.id });
      if (!updated.length) throw new Error("RegistrationChanged");
      await tx.update(emailVerificationTokens).set({ consumedAt: now }).where(eq(emailVerificationTokens.registrationRequestId, id));
      await tx.insert(auditLogs).values({ actorUserId: admin.id, action: "registration.approved", targetType: "registration", targetId: String(id), metadata: { employeeId: request.employeeId } });
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
      eq(userRegistrationRequests.status, "pending_admin"),
    )).returning({
      id: userRegistrationRequests.id,
      fullName: userRegistrationRequests.fullName,
      email: userRegistrationRequests.email,
    });
    if (rows.length) {
      await tx.update(emailVerificationTokens).set({ consumedAt: now }).where(eq(emailVerificationTokens.registrationRequestId, id));
      await tx.insert(auditLogs).values({ actorUserId: admin.id, action: "registration.rejected", targetType: "registration", targetId: String(id), metadata: { reason } });
    }
    return rows[0] ?? null;
  });
  if (!rejectedRequest) redirect(`/manage/registrations/${id}?error=Only verified requests awaiting admin approval can be rejected.`);

  let emailError = false;
  try {
    await sendRejectionEmail(rejectedRequest, reason);
  } catch (error) {
    emailError = true;
    console.error("Registration rejection email failed:", error instanceof Error ? error.message : "UnknownError");
  }
  revalidatePath("/manage/registrations");
  redirect(`/manage/registrations/${id}?success=Registration rejected.${emailError ? "&error=The rejection email could not be sent. Check the SMTP settings and notify the user manually." : ""}`);
}
