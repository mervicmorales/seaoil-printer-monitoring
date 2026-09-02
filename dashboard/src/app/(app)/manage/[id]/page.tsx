import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, locations, userModuleAccess, users } from "@/db/schema";
import { Card, PageHeader, SecondaryButton } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import SuccessBanner from "@/components/SuccessBanner";
import { emptyModuleAccess } from "@/lib/permissions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import PermissionsPanel from "../PermissionsPanel";
import { deleteUserAction, sendEmployeePasswordResetAction, updatePermissionsAction } from "../actions";

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-800">{value || "—"}</dd>
    </div>
  );
}

export default async function ViewUserPage({
  params,
  searchParams,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
  embedded?: boolean;
}) {
  const session = await requireModuleFullAccess("manage_users");
  const { id } = await params;
  const messages = (await searchParams) ?? {};
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) notFound();

  const [records, accessRows] = await Promise.all([
    db.select({
      user: users,
      location: locations.name,
      department: departments.name,
    }).from(users)
      .leftJoin(locations, eq(users.primaryLocationId, locations.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.id, userId))
      .limit(1),
    db.select().from(userModuleAccess).where(eq(userModuleAccess.userId, userId)),
  ]);
  const record = records[0];
  if (!record) notFound();

  const access = emptyModuleAccess();
  for (const row of accessRows) access[row.module as keyof typeof access] = row.fullAccess;
  const user = record.user;

  return (
    <div>
      {!embedded && (
        <PageHeader
          title={user.fullName}
          subtitle="Account Details"
          actions={<Link href="/manage"><SecondaryButton>Back to User Management</SecondaryButton></Link>}
        />
      )}
      <SuccessBanner
        message={messages.success}
        errorMessage={messages.error}
        showInline={false}
      />
      <Card className="p-6">
        <dl className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Detail label="Full Name" value={user.fullName} />
          <Detail label="Employee ID" value={user.employeeId} />
          <Detail label="Email Address" value={user.email} />
          <Detail label="Username" value={user.username} />
          <Detail label="Location" value={record.location} />
          <Detail label="Department" value={record.department} />
          <Detail label="Role" value={user.role} />
          <Detail label="Status" value={user.accountStatus} />
        </dl>

        {session.role === "admin" && <div className="mt-8 border-t pt-6">
          <h2 className="mb-3 text-sm font-semibold text-[#014171]">Page Permissions</h2>
          <PermissionsPanel
            userId={user.id}
            role={user.role}
            access={access}
            action={updatePermissionsAction}
          />
        </div>}

        {!embedded && (
          <div className="mt-8 flex flex-wrap gap-3 border-t pt-6">
            {session.role === "admin" && <>
            {user.role === "employee" && user.accountStatus === "active" && (
              <form action={sendEmployeePasswordResetAction}>
                <input type="hidden" name="id" value={user.id} />
                <button type="submit" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-[#014171] transition hover:bg-sky-100">Reset Password</button>
              </form>
            )}
            <Link href={`/manage/${user.id}/edit`}><SecondaryButton>Edit Account</SecondaryButton></Link>
            {user.id !== session.id && (
              <DeleteButton
                action={deleteUserAction}
                id={user.id}
                title="Delete user account?"
                confirmText={`Delete user "${user.username}"? This action cannot be undone.`}
                requireReason
                reasonPlaceholder="Explain why this user account is being deleted"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              />
            )}
            </>}
            {session.role === "support" && <>
              {user.role === "employee" && user.accountStatus === "active" && (
                <form action={sendEmployeePasswordResetAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <button type="submit" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-[#014171] transition hover:bg-sky-100">Reset Password</button>
                </form>
              )}
              <button type="button" disabled className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Edit Account</button>
              <button type="button" disabled className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Delete Account</button>
            </>}
          </div>
        )}
      </Card>
    </div>
  );
}
