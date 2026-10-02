import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import {
  CircleCheckBig,
  KeyRound,
  Mail,
  ShieldCheck,
  TriangleAlert,
  X,
  type IconNode,
} from "lucide";
import { db } from "@/db";
import {
  departments,
  costCenters,
  locations,
  subunits,
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

export async function RegistrationDetailPage({
  params,
  searchParams,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
  embedded?: boolean;
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
      subunit: subunits.name,
      costCenter: costCenters.code,
      reviewer: users.fullName,
    })
    .from(userRegistrationRequests)
    .leftJoin(locations, eq(locations.id, userRegistrationRequests.primaryLocationId))
    .leftJoin(departments, eq(departments.id, userRegistrationRequests.departmentId))
    .leftJoin(subunits, eq(subunits.id, userRegistrationRequests.subunitId))
    .leftJoin(costCenters, eq(costCenters.id, userRegistrationRequests.costCenterId))
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
    ["Office", row.location],
    ["Department", row.department],
    ["Subunit", row.subunit],
    ["Cost Center", row.costCenter],
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
      <PageHeader title="Registration Details" />

      <SuccessBanner
        message={messages.success}
        errorMessage={messages.error}
        showInline={false}
      />

      <Card className="overflow-hidden !border-0">
        <div className={`flex shrink-0 flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/70 ${embedded ? "gap-3 px-4 py-3" : "gap-4 px-5 py-4 sm:px-6"}`}>
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

        <div className={embedded ? "space-y-4 p-4" : "space-y-6 p-5 sm:p-6"}>
          <DetailSection
            compact={embedded}
            icon={KeyRound}
            title="General information"
            description="Registration identity and organizational assignment"
            details={[...accountDetails, ...assignmentDetails]}
          />
          {reviewDetails.some(([, value]) => value) && (
            <DetailSection
              compact={embedded}
              icon={ShieldCheck}
              title="Review information"
              description="Administrative decision and recorded reason"
              details={reviewDetails}
            />
          )}

          {request.status === "pending_email" && (
            <div className={`flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 ${embedded ? "px-3 py-2.5 text-xs leading-5" : "px-4 py-3.5 text-sm leading-6"}`}>
              <span className="mt-0.5 shrink-0 text-amber-600"><IconGlyph icon={TriangleAlert} size={17} /></span>
              <p>Approving now bypasses email verification and grants the account immediate access. Use this only after confirming the user&apos;s identity.</p>
            </div>
          )}

          {awaitingDecision && (
            <section className={`border-t border-slate-200 ${embedded ? "pt-3" : "pt-5"}`}>
              <div className={`flex items-center gap-3 ${embedded ? "mb-3" : "mb-4"}`}>
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                  <IconGlyph icon={ShieldCheck} size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#014171]">Review actions</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Approve the request or provide a reason to reject it.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-end">
                <form action={approveRegistrationAction} className={`rounded-xl border border-emerald-200 bg-emerald-50/60 ${embedded ? "p-2.5" : "p-3"}`}>
                  <input type="hidden" name="id" value={request.id} />
                  <PrimaryButton type="submit" className="w-full sm:w-auto">
                    <IconGlyph icon={CircleCheckBig} size={15} />
                    {request.status === "pending_email" ? "Approve Immediately" : "Approve"}
                  </PrimaryButton>
                </form>
                <form action={rejectRegistrationAction} className={`flex min-w-0 flex-col gap-2 rounded-xl border border-red-200 bg-red-50/50 sm:flex-row ${embedded ? "p-2.5" : "p-3"}`}>
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
  compact = false,
  className = "",
}: {
  icon: IconNode;
  title: string;
  description: string;
  details: Array<[string, DetailValue]>;
  compact?: boolean;
  className?: string;
}) {
  return (
    <section className={className}>
      <div className={`flex items-center rounded-lg bg-slate-100 ${compact ? "gap-2.5 px-3.5 py-2.5" : "gap-3 px-4 py-3"}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm ${compact ? "size-7" : "size-8"}`}>
          <IconGlyph icon={icon} size={compact ? 15 : 17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>}
        </div>
      </div>
      <dl className={compact ? "px-3 py-2" : "px-4 py-3 sm:px-5"}>
        {details.map(([label, value]) => (
          <div key={label} className={`grid min-w-0 grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] items-start gap-4 ${compact ? "py-2" : "py-2.5"}`}>
            <dt className="text-sm font-medium text-slate-500">{label}</dt>
            <dd className="break-words text-sm font-semibold text-slate-900">{value || "—"}</dd>
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
