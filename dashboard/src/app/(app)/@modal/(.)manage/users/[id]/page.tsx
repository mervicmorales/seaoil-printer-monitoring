import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ViewUserPage } from "@/app/(app)/manage/[id]/content";
import ModalShell from "@/components/ModalShell";
import DeleteButton from "@/components/DeleteButton";
import { db } from "@/db";
import { users } from "@/db/schema";
import { deleteUserAction, sendEmployeePasswordResetAction } from "@/app/(app)/manage/actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { canManageRole, hasAdminPrivileges } from "@/lib/roles";

export default async function ViewUserModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) notFound();
  const session = await requireModuleFullAccess("manage_users");
  const [user] = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    accountStatus: users.accountStatus,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) notFound();
  const canManageUser = canManageRole(session.role, user.role);

  return (
    <ModalShell
      title="Account Details"
      closeHref="/manage"
      variant="right-panel"
      hideScrollbar
      panelClassName="max-w-[52rem] !bg-white sm:m-3 sm:!h-[calc(100dvh-1.5rem)] sm:rounded-3xl sm:border sm:border-slate-200"
      contentClassName="flex-1 !overflow-x-hidden !overflow-y-auto !bg-white !p-4 sm:!p-5"
      closeButtonClassName="!rounded-full !border-transparent !bg-slate-100 !shadow-none hover:!bg-slate-200"
      headerActions={
        <>
          {hasAdminPrivileges(session.role) && canManageUser && user.role === "employee" && user.accountStatus === "active" && (
            <form action={sendEmployeePasswordResetAction}>
              <input type="hidden" name="id" value={user.id} />
              <button type="submit" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#014171] transition hover:bg-sky-100">Reset Password</button>
            </form>
          )}
          {hasAdminPrivileges(session.role) && canManageUser && <Link href={`/manage/${user.id}/edit`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Edit</Link>}
          {hasAdminPrivileges(session.role) && canManageUser && user.id !== session.id && (
            <DeleteButton
              action={deleteUserAction}
              id={user.id}
              title="Delete user account?"
              confirmText={`Delete user "${user.username}"? This action cannot be undone.`}
              requireReason
              reasonPlaceholder="Explain why this user account is being deleted"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
            />
          )}
          {session.role === "support" && <>
            {user.role === "employee" && user.accountStatus === "active" && (
              <form action={sendEmployeePasswordResetAction}>
                <input type="hidden" name="id" value={user.id} />
                <button type="submit" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#014171] transition hover:bg-sky-100">Reset Password</button>
              </form>
            )}
            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">Edit</button>
            <button type="button" disabled className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-400">Delete</button>
          </>}
        </>
      }
    >
      <ViewUserPage params={Promise.resolve({ id })} embedded />
    </ModalShell>
  );
}
