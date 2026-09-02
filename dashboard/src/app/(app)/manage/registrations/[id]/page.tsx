import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  departments,
  locations,
  userRegistrationRequests,
  users,
} from "@/db/schema";
import { Badge, Card, PageHeader, PrimaryButton } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import { requireModuleFullAccess } from "@/lib/server-utils";
import {
  approveRegistrationAction,
  rejectRegistrationAction,
  resendRegistrationVerificationAction,
} from "../actions";

type DetailValue = string | null;

export default async function RegistrationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireModuleFullAccess("registrations");
  const { id } = await params;
  const messages = await searchParams;
  const registrationId = Number(id);
  if (!Number.isInteger(registrationId) || registrationId < 1) notFound();

  const [row] = await db
    .select({
      request: userRegistrationRequests,
      location: locations.name,
      department: departments.name,
      reviewer: users.fullName,
    })
    .from(userRegistrationRequests)
    .leftJoin(locations, eq(locations.id, userRegistrationRequests.primaryLocationId))
    .leftJoin(departments, eq(departments.id, userRegistrationRequests.departmentId))
    .leftJoin(users, eq(users.id, userRegistrationRequests.reviewedBy))
    .where(eq(userRegistrationRequests.id, registrationId))
    .limit(1);
  if (!row) notFound();

  const request = row.request;
  const awaitingDecision = request.status === "pending_email" || request.status === "pending_admin";
  const accountDetails: Array<[string, DetailValue]> = [
    ["Source", request.source === "manual" ? "Manually added" : "Employee registration"],
    ["Full Name", request.fullName],
    ["Employee ID", request.employeeId],
    ["Email Address", request.email],
    ["Username", request.username],
    ["Email Verified", request.emailVerifiedAt ? formatDateTime(request.emailVerifiedAt) : "No"],
  ];
  const assignmentDetails: Array<[string, DetailValue]> = [
    ["Location", row.location],
    ["Department", row.department],
    ["Created", formatDateTime(request.createdAt)],
  ];
  const reviewDetails: Array<[string, DetailValue]> = [
    ["Reviewed By", row.reviewer],
    ["Reviewed", request.reviewedAt ? formatDateTime(request.reviewedAt) : null],
    ["Rejection Reason", request.rejectionReason],
    ["Deletion Reason", request.deletionReason],
  ];

  return (
    <div>
      <PageHeader
        title="Registration Detail"
        subtitle={request.employeeId || request.email}
      />

      <SuccessBanner
        message={messages.success}
        errorMessage={messages.error}
        showInline={false}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Registration Status</p>
            <div className="mt-2">
              <Badge color={registrationStatusColor(request.status)}>
                {formatStatus(request.status)}
              </Badge>
            </div>
          </div>
          {(request.status === "pending_email" || request.status === "expired") && (
            <form action={resendRegistrationVerificationAction}>
              <input type="hidden" name="id" value={request.id} />
              <button
                type="submit"
                className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-[#014171] transition hover:bg-sky-100"
              >
                Resend Verification Email
              </button>
            </form>
          )}
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <DetailSection title="Account Details" details={accountDetails} />
          <DetailSection title="Assignment Details" details={assignmentDetails} />
          {reviewDetails.some(([, value]) => value) && (
            <DetailSection title="Review Details" details={reviewDetails} />
          )}

          {request.status === "pending_email" && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
              Approving now bypasses email verification and grants the account immediate access. Use this only after confirming the user&apos;s identity.
            </p>
          )}

          {awaitingDecision && (
            <div className="border-t border-slate-100 pt-5">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Review Actions
              </h3>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <form action={approveRegistrationAction}>
                  <input type="hidden" name="id" value={request.id} />
                  <PrimaryButton type="submit" className="w-full sm:w-auto">
                    {request.status === "pending_email" ? "Approve Immediately" : "Approve"}
                  </PrimaryButton>
                </form>
                <form action={rejectRegistrationAction} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="id" value={request.id} />
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Rejection reason</span>
                    <input
                      name="reason"
                      required
                      minLength={3}
                      placeholder="Enter rejection reason"
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40"
                    />
                  </label>
                  <button
                    type="submit"
                    className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    Reject
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

function DetailSection({
  title,
  details,
}: {
  title: string;
  details: Array<[string, DetailValue]>;
}) {
  return (
    <section>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs font-medium text-slate-500">{label}</dt>
            <dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function registrationStatusColor(status: string) {
  if (status === "approved") return "green" as const;
  if (["rejected", "expired", "account_deleted"].includes(status)) return "red" as const;
  return "yellow" as const;
}

function formatStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}
