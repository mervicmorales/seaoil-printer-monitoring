import { UserPlus } from "lucide";
import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import UserForm from "../UserForm";
import { createUserAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { getDepartments, getLocations } from "@/lib/lookups";

export async function NewUserPage({
  searchParams,
  embedded = false,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  embedded?: boolean;
}) {
  const session = await requireModuleFullAccess("manage_users");
  const params = (await searchParams) ?? {};
  const returnTo = params.returnTo === "/manage/registrations" ? "/manage/registrations" : "/manage";
  const [locations, departments] = await Promise.all([getLocations(), getDepartments()]);
  return (
    <div>
      <PageHeader
        title="Create Account"
        subtitle="Add identity, assignment, role, and sign-in details for a new user."
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="user-create-form"
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
          >
            <IconGlyph icon={UserPlus} size={14} />
            Create Account
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-5 sm:p-6">
        <UserForm
          mode="create"
          action={createUserAction}
          locations={locations}
          departments={departments}
          returnTo={returnTo}
          employeeOnly={session.role === "support"}
          showActions={!embedded}
          actorRole={session.role}
        />
      </Card>
    </div>
  );
}
