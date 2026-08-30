import { notFound } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import UserForm from "../../UserForm";
import { updateUserAction } from "../../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { getDepartments, getLocations } from "@/lib/lookups";

export default async function EditUserPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModuleFullAccess("manage_users");
  const { id } = await params;
  const [rows, locations, departments] = await Promise.all([
    db.select().from(users).where(eq(users.id, Number(id))).limit(1),
    getLocations(),
    getDepartments(),
  ]);
  const user = rows[0];
  if (!user) notFound();

  return (
    <div>
      <PageHeader title="Edit User" subtitle={user.username} />
      <Card className="p-6">
        <UserForm mode="edit" action={updateUserAction} user={user} locations={locations} departments={departments} />
      </Card>
    </div>
  );
}
