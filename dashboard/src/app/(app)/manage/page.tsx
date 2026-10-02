import Link from "next/link";
import { db } from "@/db";
import { costCenters, departments, locations, subunits, users } from "@/db/schema";
import { desc, eq, ilike, or } from "drizzle-orm";
import { Eye, SearchX } from "lucide";
import { PageHeader, TableCard, Badge, IconGlyph } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { roleLabel } from "@/lib/roles";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import Search from "@/components/Search";
import RecordTableToolbar from "@/components/RecordTableToolbar";
import PrinterColumnFilter, { type PrinterColumnFilterOption } from "@/app/(app)/printers/PrinterColumnFilter";

export const dynamic = "force-dynamic";

export default async function ManageUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireModuleFullAccess("manage_users");
  const sp = await searchParams;
  const query = firstParam(sp.q).trim();
  const statusFilters = paramList(sp.status);
  const sort = firstParam(sp.sort);

  const baseUsers = await db.select({
    id: users.id,
    fullName: users.fullName,
    employeeId: users.employeeId,
    email: users.email,
    role: users.role,
    accountStatus: users.accountStatus,
    location: locations.name,
    department: departments.name,
    subunit: subunits.name,
    costCenter: costCenters.code,
  }).from(users)
    .leftJoin(locations, eq(users.primaryLocationId, locations.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .leftJoin(subunits, eq(users.subunitId, subunits.id))
    .leftJoin(costCenters, eq(users.costCenterId, costCenters.id))
    .where(query ? or(
      ilike(users.fullName, `%${query}%`),
      ilike(users.employeeId, `%${query}%`),
      ilike(users.email, `%${query}%`),
      ilike(locations.name, `%${query}%`),
      ilike(departments.name, `%${query}%`),
      ilike(subunits.name, `%${query}%`),
      ilike(costCenters.code, `%${query}%`),
    ) : undefined)
    .orderBy(desc(users.createdAt), desc(users.id));
  const statusOptions = uniqueFilterOptions(baseUsers.map((user) => ({
    value: user.accountStatus,
    label: formatAccountStatus(user.accountStatus),
  })));
  const allUsers = baseUsers
    .filter((user) => matchesSelected(user.accountStatus, statusFilters))
    .sort((left, right) => {
      if (sort === "status_asc") return formatAccountStatus(left.accountStatus).localeCompare(formatAccountStatus(right.accountStatus));
      if (sort === "status_desc") return formatAccountStatus(right.accountStatus).localeCompare(formatAccountStatus(left.accountStatus));
      return 0;
    });

  return (
    <div className="flex h-[calc(100dvh-103px)] min-h-0 flex-col overflow-hidden sm:h-[calc(100dvh-111px)]">
      <PageHeader
        parentTitle="User Management"
        title="User Management"
      />
      <SuccessBanner message={firstParam(sp.success) || undefined} errorMessage={firstParam(sp.error) || undefined} showInline={false} />

      <TableCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <RecordTableToolbar count={allUsers.length} label="account">
          <AutoSubmitFilterForm method="get" resetKey={[statusFilters.join(","), sort].join("|")}>
            {statusFilters.map((value) => <input key={`status-${value}`} type="hidden" name="status" value={value} />)}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <Search name="q" defaultValue={query} placeholder="Search accounts" ariaLabel="Search user accounts" />
          </AutoSubmitFilterForm>
        </RecordTableToolbar>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3">Full Name / Employee ID</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Office / Department</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-2.5">
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 leading-4">Status</span>
                    <PrinterColumnFilter label="Status" paramName="status" options={statusOptions} selectedValues={statusFilters} currentSort={sort} sortAscValue="status_asc" sortDescValue="status_desc" />
                  </div>
                </th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-500">
                    <span className="inline-flex flex-col items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><IconGlyph icon={SearchX} size={20} /></span>
                      <span>No accounts found</span>
                    </span>
                  </td>
                </tr>
              ) : allUsers.map((u) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-slate-800">{u.fullName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{u.employeeId || "—"}</p>
                  </td>
                  <td className="px-4 py-3 align-top">{u.email || "—"}</td>
                  <td className="px-4 py-3 align-top">
                    <p>{[u.location, u.department].filter(Boolean).join(" / ") || "—"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{[u.subunit, u.costCenter].filter(Boolean).join(" · ") || "No subunit / cost center"}</p>
                  </td>
                  <td className="px-4 py-3 align-top"><Badge color={u.role === "super_admin" ? "orange" : u.role === "admin" ? "blue" : "gray"}>{roleLabel(u.role)}</Badge></td>
                  <td className="px-4 py-3 align-top"><Badge color={u.accountStatus === "active" ? "green" : "red"}>{u.accountStatus}</Badge></td>
                  <td className="px-4 py-3 text-right align-top">
                    <Link href={`/manage/users/${u.id}`} aria-label={`View ${u.fullName}`} className="inline-flex size-8 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100">
                      <IconGlyph icon={Eye} size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableCard>
    </div>
  );
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function paramList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return value ? [value] : [];
}

function uniqueFilterOptions(options: PrinterColumnFilterOption[]) {
  return [...new Map(options.map((option) => [option.value, option])).values()]
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
}

function matchesSelected(value: string, selected: string[]) {
  return selected.length === 0 || selected.includes(value);
}

function formatAccountStatus(status: string) {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
