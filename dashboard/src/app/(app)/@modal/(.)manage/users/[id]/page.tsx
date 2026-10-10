import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ViewUserPage } from "@/app/(app)/manage/[id]/content";
import ModalShell from "@/components/ModalShell";
import DeleteButton from "@/components/DeleteButton";
import { db } from "@/db";
import { users } from "@/db/schema";
import { deleteUserAction } from "@/app/(app)/manage/actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { canManageRole, canSetTemporaryPassword, hasAdminPrivileges } from "@/lib/roles";
import TemporaryPasswordDialog from "@/app/(app)/manage/TemporaryPasswordDialog";

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
    fullName: users.fullName,
    role: users.role,
    accountStatus: users.accountStatus,
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) notFound();
  const canManageUser = canManageRole(session.role, user.role);
  const canAssignTemporaryPassword = canSetTemporaryPassword(session.role, user.role)
    && user.accountStatus === "active";

  return (
    <ModalShell
      title="Account Details"
      closeHref="/manage"
      variant="right-panel"
      hideScrollbar
      panelClassName="max-w-[52rem] !bg-app-surface sm:m-3 sm:!h-[calc(100dvh-1.5rem)] sm:rounded-3xl sm:border sm:border-app-border"
      contentClassName="flex-1 !overflow-x-hidden !overflow-y-auto !bg-app-surface !p-4 sm:!p-5"
      closeButtonClassName="!rounded-full !border-transparent !bg-app-surface-subtle !shadow-none hover:!bg-app-surface-raised"
      headerActions={
        <>
          {hasAdminPrivileges(session.role) && canManageUser && canAssignTemporaryPassword && (
            <TemporaryPasswordDialog userId={user.id} userName={user.fullName} compact />
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
            {canAssignTemporaryPassword && (
              <TemporaryPasswordDialog userId={user.id} userName={user.fullName} compact />
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
