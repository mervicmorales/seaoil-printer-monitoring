import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Save } from "lucide";
import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import UserForm from "../../UserForm";
import { updateUserAction } from "../../actions";
import { requireAdmin } from "@/lib/server-utils";
import { getDepartments, getLocations } from "@/lib/lookups";
import { canManageRole } from "@/lib/roles";

export default async function EditUserPage({
  params,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  embedded?: boolean;
}) {
  const actor = await requireAdmin("manage_users");
  const { id } = await params;
  const [rows, locations, departments] = await Promise.all([
    db.select().from(users).where(eq(users.id, Number(id))).limit(1),
    getLocations(),
    getDepartments(),
  ]);
  const user = rows[0];
  if (!user) notFound();
  if (!canManageRole(actor.role, user.role)) redirect("/access-denied");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Edit Account"
        subtitle={`Update identity, role, and assignment details for ${user.fullName} (${user.username}).`}
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="user-edit-form"
            className="min-h-9 px-3 py-1.5 text-xs"
          >
            <IconGlyph icon={Save} size={14} />
            Save Changes
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-5 sm:p-6">
        <UserForm
          mode="edit"
          action={updateUserAction}
          user={user}
          locations={locations}
          departments={departments}
          showActions={!embedded}
          actorRole={actor.role}
        />
      </Card>
    </div>
  );
}
