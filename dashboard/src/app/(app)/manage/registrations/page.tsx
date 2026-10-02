import Link from "next/link";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Eye, KeyRound, Plus } from "lucide";
import { db } from "@/db";
import { departments, locations, userRegistrationRequests } from "@/db/schema";
import { Badge, EmptyState, IconGlyph, PageHeader, TableCard } from "@/components/ui";
import AutoSubmitFilterForm from "@/components/AutoSubmitFilterForm";
import Search from "@/components/Search";
import RecordTableToolbar from "@/components/RecordTableToolbar";
import SuccessBanner from "@/components/SuccessBanner";
import { getModuleAccessMap, requireModuleFullAccess } from "@/lib/server-utils";
import { expireRegistrationRequests } from "@/lib/registration-requests";
import PrinterColumnFilter, { type PrinterColumnFilterOption } from "@/app/(app)/printers/PrinterColumnFilter";

export const dynamic = "force-dynamic";

type RegistrationSearchParams = {
  q?: string | string[];
  priority?: string | string[];
  status?: string | string[];
  sort?: string | string[];
  success?: string | string[];
  error?: string | string[];
};

const BLANK_FILTER_VALUE = "__blank__";

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: Promise<RegistrationSearchParams>;
}) {
  const session = await requireModuleFullAccess("registrations");
  await expireRegistrationRequests();

  const params = await searchParams;
  const access = await getModuleAccessMap(session.id, session.role);
  const query = firstParam(params.q).trim();
  const priorityFilters = paramList(params.priority);
  const statusFilters = paramList(params.status);
  const sort = firstParam(params.sort);
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
  const baseRows = await db
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
      );
  const priorityOptions = uniqueFilterOptions(baseRows.map((row) => ({
    value: row.priority ?? BLANK_FILTER_VALUE,
    label: row.priority ? priorityLabel(row.priority) : "(Blanks)",
  })));
  const statusOptions = uniqueFilterOptions(baseRows.map((row) => ({ value: row.status, label: formatStatus(row.status) })));
  const rows = baseRows
    .filter((row) => (
      matchesSelected(row.priority ?? BLANK_FILTER_VALUE, priorityFilters)
      && matchesSelected(row.status, statusFilters)
    ))
    .sort((left, right) => compareRegistrationRows(left, right, sort));

  return (
    <div className="flex h-[calc(100dvh-103px)] min-h-0 flex-col sm:h-[calc(100dvh-111px)]">
      <PageHeader
        parentTitle="Registrations"
        title="Registration Records"
        hideTitle
      />

      <SuccessBanner
        message={firstParam(params.success) || undefined}
        errorMessage={firstParam(params.error) || undefined}
        showInline={false}
      />

      <TableCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <RecordTableToolbar count={rows.length} label="registration">
          <AutoSubmitFilterForm
            method="get"
            resetKey={[priorityFilters.join(","), statusFilters.join(","), sort].join("|")}
          >
            {priorityFilters.map((value) => <input key={`priority-${value}`} type="hidden" name="priority" value={value} />)}
            {statusFilters.map((value) => <input key={`status-${value}`} type="hidden" name="status" value={value} />)}
            {sort && <input type="hidden" name="sort" value={sort} />}
            <Search name="q" defaultValue={query} placeholder="Name, ID or email" ariaLabel="Search registration records" />
          </AutoSubmitFilterForm>
          {access.manage_users && (
            <Link href="/manage/new?returnTo=/manage/registrations" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#00365f]">
              <IconGlyph icon={Plus} size={15} />
              Create Account
            </Link>
          )}
        </RecordTableToolbar>
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {rows.length === 0 ? (
          <EmptyState message="No registrations found" />
        ) : (
          <>
            <div className="divide-y divide-slate-100 lg:hidden">
              {rows.map((row) => <RegistrationCard key={row.id} row={row} />)}
            </div>
            <div className="hidden lg:block">
              <table className="w-full min-w-[1100px] text-left text-sm">
                <thead className="bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3">Full Name / Employee ID</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Office / Department</th>
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Priority">
                    <PrinterColumnFilter label="Priority" paramName="priority" options={priorityOptions} selectedValues={priorityFilters} currentSort={sort} sortAscValue="priority_asc" sortDescValue="priority_desc" sortAscLabel="Low to high" sortDescLabel="High to low" />
                  </FilterableHeading>
                </th>
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Status">
                    <PrinterColumnFilter label="Status" paramName="status" options={statusOptions} selectedValues={statusFilters} currentSort={sort} sortAscValue="status_asc" sortDescValue="status_desc" />
                  </FilterableHeading>
                </th>
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
                      aria-label={`Review registration for ${row.fullName}`}
                      className="inline-flex size-8 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100"
                    >
                      <IconGlyph icon={Eye} size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </div>
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
        <RegistrationField label="Office" value={row.location || "—"} />
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

function FilterableHeading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="min-w-0 leading-4">{label}</span>
      {children}
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

function compareRegistrationRows(left: RegistrationRow, right: RegistrationRow, sort: string) {
  const priorityRank = { low: 1, medium: 2, high: 3 } as const;
  if (sort === "priority_asc" || sort === "priority_desc") {
    const leftRank = left.priority ? priorityRank[left.priority] : 0;
    const rightRank = right.priority ? priorityRank[right.priority] : 0;
    return sort === "priority_asc" ? leftRank - rightRank : rightRank - leftRank;
  }
  if (sort === "status_asc") return formatStatus(left.status).localeCompare(formatStatus(right.status));
  if (sort === "status_desc") return formatStatus(right.status).localeCompare(formatStatus(left.status));
  return 0;
}
