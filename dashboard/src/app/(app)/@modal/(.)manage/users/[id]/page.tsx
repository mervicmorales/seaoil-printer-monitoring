import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import ViewUserPage from "@/app/(app)/manage/[id]/page";
import ModalShell from "@/components/ModalShell";
import DeleteButton from "@/components/DeleteButton";
import { db } from "@/db";
import { users } from "@/db/schema";
import { deleteUserAction } from "@/app/(app)/manage/actions";
import { requireModuleFullAccess } from "@/lib/server-utils";

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
  }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) notFound();

  return (
    <ModalShell
      title="Account Details"
      closeHref="/manage"
      headerActions={
        <>
          <Link href={`/manage/${user.id}/edit`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50">Edit</Link>
          {user.id !== session.id && (
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
        </>
      }
    >
      <ViewUserPage params={Promise.resolve({ id })} embedded />
    </ModalShell>
  );
}
