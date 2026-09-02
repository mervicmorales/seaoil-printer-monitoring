import Link from "next/link";
import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, locations, userRegistrationRequests } from "@/db/schema";
import { Badge, EmptyState, PageHeader, PrimaryButton, TableCard } from "@/components/ui";
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
      .orderBy(asc(userRegistrationRequests.createdAt)),
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
            <Link href="/manage/new?returnTo=/manage/registrations">
              <PrimaryButton>+ Create Account</PrimaryButton>
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
            name="q"
            defaultValue={query}
            placeholder="Name, employee ID or email"
            aria-label="Search registration records"
          />
          <select
            name="status"
            defaultValue={params.status || ""}
            aria-label="Filter registrations by status"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
          >
            <option value="">All Statuses</option>
            {REGISTRATION_STATUSES.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <select
            name="location"
            defaultValue={params.location || ""}
            aria-label="Filter registrations by location"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
          >
            <option value="">All Locations</option>
            {locationRows.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <select
            name="department"
            defaultValue={params.department || ""}
            aria-label="Filter registrations by department"
            className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
          >
            <option value="">All Departments</option>
            {departmentRows.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
          <Link
            href="/manage/registrations"
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Clear
          </Link>
        </AutoSubmitFilterForm>
      </CollapsibleFilterPanel>

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No registration records match the selected filters." />
        ) : (
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
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
                <tr key={row.id}>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-slate-800">{row.fullName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{row.employeeId || "—"}</p>
                  </td>
                  <td className="px-4 py-3 align-top">{row.email}</td>
                  <td className="px-4 py-3 align-top">{[row.location, row.department].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-4 py-3 align-top">
                    {row.priority ? (
                      <Badge color={row.priority === "high" ? "red" : row.priority === "medium" ? "yellow" : "green"}>
                        {row.priority === "high" ? "High Priority" : row.priority === "medium" ? "Medium Priority" : "Low Priority"}
                      </Badge>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Badge color={row.status === "approved" ? "green" : row.status === "rejected" || row.status === "expired" || row.status === "account_deleted" ? "red" : "yellow"}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <Link
                      href={`/manage/registrations/${row.id}`}
                      className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#014171] transition hover:bg-sky-100"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
}
