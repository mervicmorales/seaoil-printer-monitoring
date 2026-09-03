import Link from "next/link";
import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Eye, KeyRound, Plus, X } from "lucide";
import { db } from "@/db";
import { departments, locations, userRegistrationRequests } from "@/db/schema";
import { Badge, EmptyState, IconGlyph, PageHeader, TableCard } from "@/components/ui";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import CollapsibleFilterPanel from "@/components/CollapsibleFilterPanel";
import SearchInput from "@/components/SearchInput";
import SuccessBanner from "@/components/SuccessBanner";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";
import { expireRegistrationRequests } from "@/lib/registration-requests";

export const dynamic = "force-dynamic";

const REGISTRATION_STATUSES = [
  { value: "pending_email", label: "Pending Email" },
  { value: "pending_admin", label: "Pending Admin" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "account_deleted", label: "Account Deleted" },
];

type RegistrationSearchParams = {
  q?: string;
  status?: string;
  location?: string;
  department?: string;
  success?: string;
  error?: string;
};

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<RegistrationSearchParams>;
}) {
  const session = await requireModuleFullAccess("registrations");
  await expireRegistrationRequests();

  const params = await searchParams;
  const access = await getModuleAccessMap(session.id, session.role);
  const query = params.q?.trim() ?? "";
  const conditions = [];

  if (query) {
    conditions.push(
      or(
        ilike(userRegistrationRequests.fullName, `%${query}%`),
        ilike(userRegistrationRequests.employeeId, `%${query}%`),
        ilike(userRegistrationRequests.email, `%${query}%`),
      )!,
    );
  }
  if (params.status) conditions.push(eq(userRegistrationRequests.status, params.status));
  if (Number(params.location)) {
    conditions.push(eq(userRegistrationRequests.primaryLocationId, Number(params.location)));
  }
  if (Number(params.department)) {
    conditions.push(eq(userRegistrationRequests.departmentId, Number(params.department)));
  }

  const [rows, locationRows, departmentRows] = await Promise.all([
    db
      .select({
        id: userRegistrationRequests.id,
        fullName: userRegistrationRequests.fullName,
        employeeId: userRegistrationRequests.employeeId,
        email: userRegistrationRequests.email,
        status: userRegistrationRequests.status,
        priority: sql<"low" | "medium" | "high" | null>`
          case
            when ${userRegistrationRequests.status} <> 'pending_admin' then null
            when now() < coalesce(${userRegistrationRequests.emailVerifiedAt}, ${userRegistrationRequests.createdAt}) + interval '8 hours 1 minute' then 'low'
            when now() < coalesce(${userRegistrationRequests.emailVerifiedAt}, ${userRegistrationRequests.createdAt}) + interval '24 hours' then 'medium'
            else 'high'
          end
        `,
        location: locations.name,
        department: departments.name,
      })
      .from(userRegistrationRequests)
      .leftJoin(locations, eq(locations.id, userRegistrationRequests.primaryLocationId))
      .leftJoin(departments, eq(departments.id, userRegistrationRequests.departmentId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(
        desc(userRegistrationRequests.createdAt),
        desc(userRegistrationRequests.id),
      ),
    db.select().from(locations).orderBy(asc(locations.name)),
    db.select().from(departments).orderBy(asc(departments.name)),
  ]);

  const activeFilterCount = [query, params.status, params.location, params.department].filter(Boolean).length;

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader
        title="Registration Records"
        subtitle="Review employee registrations and manually created user accounts."
        actions={
          access.manage_users ? (
            <Link
              href="/manage/new?returnTo=/manage/registrations"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md"
            >
              <IconGlyph icon={Plus} size={16} />
              Create Account
            </Link>
          ) : undefined
        }
      />

      <SuccessBanner
        message={params.success}
        errorMessage={params.error}
        showInline={false}
      />

      <CollapsibleFilterPanel activeFilterCount={activeFilterCount}>
        <AutoSubmitFilterForm
          resetKey={[query, params.status ?? "", params.location ?? "", params.department ?? ""].join("|")}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]"
          method="get"
        >
          <SearchInput
            key={query}
            label="Registration search"
            name="q"
            defaultValue={query}
            placeholder="Name, employee ID or email"
            aria-label="Search registration records"
          />
          <RegistrationFilter label="Status">
            <select
              name="status"
              defaultValue={params.status || ""}
              aria-label="Filter registrations by status"
              className={filterSelectClassName}
            >
              <option value="">All Statuses</option>
              {REGISTRATION_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </select>
          </RegistrationFilter>
          <RegistrationFilter label="Location">
            <select
              name="location"
              defaultValue={params.location || ""}
              aria-label="Filter registrations by location"
              className={filterSelectClassName}
            >
              <option value="">All Locations</option>
              {locationRows.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </RegistrationFilter>
          <RegistrationFilter label="Department">
            <select
              name="department"
              defaultValue={params.department || ""}
              aria-label="Filter registrations by department"
              className={filterSelectClassName}
            >
              <option value="">All Departments</option>
              {departmentRows.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </RegistrationFilter>
          <div className="flex items-end">
            <Link
              href="/manage/registrations"
              className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#014171]/20 lg:w-auto"
            >
              <IconGlyph icon={X} size={14} />
              Clear
            </Link>
          </div>
        </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Account intake</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Registration records</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {rows.length} records
        </span>
      </div>

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No registration records match the selected filters." />
        ) : (
          <>
            <div className="divide-y divide-slate-100 lg:hidden">
              {rows.map((row) => <RegistrationCard key={row.id} row={row} />)}
            </div>
            <div className="hidden lg:block">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50/95 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Full Name / Employee ID</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Location / Department</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-4 align-top">
                    <p className="font-bold text-slate-800">{row.fullName}</p>
                    <p className="mt-1 font-mono text-[11px] font-medium text-slate-500">{row.employeeId || "—"}</p>
                  </td>
                  <td className="px-4 py-4 align-top text-slate-700">{row.email}</td>
                  <td className="px-4 py-4 align-top text-slate-700">{[row.location, row.department].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-4 py-4 align-top">
                    {row.priority ? (
                      <Badge color={priorityColor(row.priority)}>{priorityLabel(row.priority)}</Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-4 align-top">
                    <Badge color={registrationStatusColor(row.status)}>
                      {formatStatus(row.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-right align-top">
                    <Link
                      href={`/manage/registrations/${row.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-[#014171] shadow-sm transition hover:bg-sky-100"
                    >
                      <IconGlyph icon={Eye} size={13} />
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </TableCard>
    </div>
  );
}

type RegistrationRow = {
  id: number;
  fullName: string;
  employeeId: string | null;
  email: string;
  status: string;
  priority: "low" | "medium" | "high" | null;
  location: string | null;
  department: string | null;
};

function RegistrationCard({ row }: { row: RegistrationRow }) {
  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={KeyRound} size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">{row.fullName}</p>
            <p className="mt-1 truncate text-xs text-slate-500">{row.email}</p>
          </div>
        </div>
        <Badge color={registrationStatusColor(row.status)}>{formatStatus(row.status)}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
        <RegistrationField label="Employee ID" value={row.employeeId || "—"} mono />
        <RegistrationField label="Priority">
          {row.priority ? <Badge color={priorityColor(row.priority)}>{priorityLabel(row.priority)}</Badge> : "—"}
        </RegistrationField>
        <RegistrationField label="Location" value={row.location || "—"} />
        <RegistrationField label="Department" value={row.department || "—"} />
      </dl>
      <Link
        href={`/manage/registrations/${row.id}`}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-[#014171] shadow-sm transition hover:bg-sky-100"
      >
        <IconGlyph icon={Eye} size={14} />
        Review registration
      </Link>
    </article>
  );
}

function RegistrationField({
  label,
  value,
  mono = false,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
      <dd className={`mt-1 break-words text-xs font-semibold text-slate-700 ${mono ? "font-mono" : ""}`}>{children ?? value}</dd>
    </div>
  );
}

function RegistrationFilter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function priorityColor(priority: "low" | "medium" | "high") {
  return priority === "high" ? "red" as const : priority === "medium" ? "yellow" as const : "green" as const;
}

function priorityLabel(priority: "low" | "medium" | "high") {
  return `${priority.charAt(0).toUpperCase()}${priority.slice(1)} Priority`;
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

const filterSelectClassName = "h-10 w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 hover:bg-slate-50 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15";
