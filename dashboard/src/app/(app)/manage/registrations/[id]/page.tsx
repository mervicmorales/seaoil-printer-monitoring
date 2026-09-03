import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  CircleCheckBig,
  KeyRound,
  Mail,
  MapPin,
  ShieldCheck,
  TriangleAlert,
  X,
  type IconNode,
} from "lucide";
import { db } from "@/db";
import {
  departments,
  locations,
  userRegistrationRequests,
  users,
} from "@/db/schema";
import { Badge, Card, IconGlyph, PageHeader, PrimaryButton } from "@/components/ui";
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
      />

      <SuccessBanner
        message={messages.success}
        errorMessage={messages.error}
        showInline={false}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
              <IconGlyph icon={KeyRound} size={18} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Registration status</p>
              <div className="mt-1.5">
                <Badge color={registrationStatusColor(request.status)}>
                  {formatStatus(request.status)}
                </Badge>
              </div>
            </div>
          </div>
          {(request.status === "pending_email" || request.status === "expired") && (
            <form action={resendRegistrationVerificationAction}>
              <input type="hidden" name="id" value={request.id} />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-[#014171] shadow-sm transition hover:bg-sky-100"
              >
                <IconGlyph icon={Mail} size={14} />
                Resend Verification Email
              </button>
            </form>
          )}
        </div>

        <div className="space-y-6 p-5 sm:p-6">
          <DetailSection
            icon={KeyRound}
            title="Account details"
            description="Identity, source, and sign-in verification"
            details={accountDetails}
          />
          <DetailSection
            icon={MapPin}
            title="Assignment details"
            description="Primary organizational placement and submission date"
            details={assignmentDetails}
          />
          {reviewDetails.some(([, value]) => value) && (
            <DetailSection
              icon={ShieldCheck}
              title="Review details"
              description="Administrative decision and recorded reason"
              details={reviewDetails}
            />
          )}

          {request.status === "pending_email" && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm leading-6 text-amber-800">
              <span className="mt-0.5 shrink-0 text-amber-600"><IconGlyph icon={TriangleAlert} size={17} /></span>
              <p>Approving now bypasses email verification and grants the account immediate access. Use this only after confirming the user&apos;s identity.</p>
            </div>
          )}

          {awaitingDecision && (
            <section className="border-t border-slate-200 pt-5">
              <div className="mb-4 flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                  <IconGlyph icon={ShieldCheck} size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#014171]">Review actions</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Approve the request or provide a reason to reject it.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end">
                <form action={approveRegistrationAction} className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <input type="hidden" name="id" value={request.id} />
                  <PrimaryButton type="submit" className="w-full sm:w-auto">
                    <IconGlyph icon={CircleCheckBig} size={15} />
                    {request.status === "pending_email" ? "Approve Immediately" : "Approve"}
                  </PrimaryButton>
                </form>
                <form action={rejectRegistrationAction} className="flex min-w-0 flex-col gap-2 rounded-xl border border-red-200 bg-red-50/50 p-3 sm:flex-row">
                  <input type="hidden" name="id" value={request.id} />
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Rejection reason</span>
                    <input
                      name="reason"
                      required
                      minLength={3}
                      placeholder="Enter rejection reason"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-200"
                    />
                  </label>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-red-300"
                  >
                    <IconGlyph icon={X} size={14} />
                    Reject
                  </button>
                </form>
              </div>
            </section>
          )}
        </div>
      </Card>
    </div>
  );
}

function DetailSection({
  icon,
  title,
  description,
  details,
}: {
  icon: IconNode;
  title: string;
  description: string;
  details: Array<[string, DetailValue]>;
}) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
          <IconGlyph icon={icon} size={17} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-[#014171]">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
            <dd className="mt-1.5 break-words text-sm font-semibold text-slate-800">{value || "—"}</dd>
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
