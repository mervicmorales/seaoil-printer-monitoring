import Link from "next/link";
import { db } from "@/db";
import { users, userModuleAccess } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { PageHeader, TableCard, Badge, PrimaryButton, EmptyState } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import DeleteButton from "@/components/DeleteButton";
import PermissionsPanel from "./PermissionsPanel";
import { deleteUserAction, updatePermissionsAction } from "./actions";
import { requireAdmin } from "@/lib/server-utils";
import { MODULES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function ManageUsersPage({ searchParams }: { searchParams: Promise<{ success?: string }> }) {
  const session = await requireAdmin();
  const sp = await searchParams;

  const allUsers = await db.select().from(users).orderBy(asc(users.fullName));
  const accessRows = await db.select().from(userModuleAccess);
  const accessByUser = new Map<number, Record<string, boolean>>();
  for (const row of accessRows) {
    const map = accessByUser.get(row.userId) ?? {};
    map[row.module] = row.fullAccess;
    accessByUser.set(row.userId, map);
  }

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader
        title="User Management"
        subtitle="Manage user accounts and configure module access permissions."
        actions={<Link href="/manage/new"><PrimaryButton>+ Add User</PrimaryButton></Link>}
      />
      <SuccessBanner message={sp.success} />

      <TableCard className="min-h-0 flex-1 overflow-x-auto overflow-y-scroll overscroll-contain">
        {allUsers.length === 0 ? (
          <EmptyState message="No users found." />
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Username</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allUsers.map((u) => {
                const map = { dashboard: false, printers: false, toner: false, contract: false, repair: false, system: false, ...accessByUser.get(u.id) };
                return (
                  <tr key={u.id}>
                    <td className="px-4 py-3 align-top font-medium">{u.fullName}</td>
                    <td className="px-4 py-3 align-top">{u.email}</td>
                    <td className="px-4 py-3 align-top">{u.username}</td>
                    <td className="px-4 py-3 align-top"><Badge color={u.role === "admin" ? "blue" : "gray"}>{u.role}</Badge></td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Link href={`/manage/${u.id}/edit`} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">Edit</Link>
                          {u.id !== session.id && (
                            <DeleteButton action={deleteUserAction} id={u.id} confirmText={`Delete user "${u.username}"?`} />
                          )}
                        </div>
                        <PermissionsPanel userId={u.id} role={u.role} access={map} action={updatePermissionsAction} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
}
