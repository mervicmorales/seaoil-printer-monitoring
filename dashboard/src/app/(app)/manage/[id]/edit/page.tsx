import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import UserForm from "../../UserForm";
import { updateUserAction } from "../../actions";
import { requireAdmin } from "@/lib/server-utils";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const rows = await db.select().from(users).where(eq(users.id, Number(id))).limit(1);
  const user = rows[0];
  if (!user) notFound();

  return (
    <div>
      <PageHeader title="Edit User" subtitle={user.username} />
      <Card className="p-6">
        <UserForm mode="edit" action={updateUserAction} user={user} />
      </Card>
    </div>
  );
}
