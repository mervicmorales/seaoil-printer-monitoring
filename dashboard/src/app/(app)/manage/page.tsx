import Link from "next/link";
import { db } from "@/db";
import { departments, locations, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PageHeader, TableCard, Badge, EmptyState } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import { requireModuleFullAccess } from "@/lib/server-utils";

export const dynamic = "force-dynamic";

export default async function ManageUsersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireModuleFullAccess("manage_users");
  const sp = await searchParams;

  const allUsers = await db.select({
    id: users.id,
    fullName: users.fullName,
    employeeId: users.employeeId,
    email: users.email,
    role: users.role,
    accountStatus: users.accountStatus,
    location: locations.name,
    department: departments.name,
  }).from(users)
    .leftJoin(locations, eq(users.primaryLocationId, locations.id))
    .leftJoin(departments, eq(users.departmentId, departments.id))
    .orderBy(desc(users.createdAt), desc(users.id));

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-0 flex-col overflow-hidden">
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts and configure module access permissions."
      />
      <SuccessBanner message={sp.success} errorMessage={sp.error} showInline={false} />

      <TableCard className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {allUsers.length === 0 ? (
          <EmptyState message="No users found." />
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Full Name / Employee ID</th>
                <th className="px-4 py-3">Email Address</th>
                <th className="px-4 py-3">Location / Department</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-slate-800">{u.fullName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{u.employeeId || "—"}</p>
                  </td>
                  <td className="px-4 py-3 align-top">{u.email}</td>
                  <td className="px-4 py-3 align-top">{[u.location, u.department].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-4 py-3 align-top"><Badge color={u.role === "admin" ? "blue" : "gray"}>{u.role}</Badge></td>
                  <td className="px-4 py-3 align-top"><Badge color={u.accountStatus === "active" ? "green" : "red"}>{u.accountStatus}</Badge></td>
                  <td className="px-4 py-3 text-right align-top">
                    <Link href={`/manage/users/${u.id}`} className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#014171] transition hover:bg-sky-100">View</Link>
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
