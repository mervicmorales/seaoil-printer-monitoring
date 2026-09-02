import { PageHeader, Card, PrimaryButton } from "@/components/ui";
import UserForm from "../UserForm";
import { createUserAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { getDepartments, getLocations } from "@/lib/lookups";

export default async function NewUserPage({
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
        subtitle="Create a new user account."
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="user-create-form"
            className="px-3 py-1.5 text-xs"
          >
            Create Account
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-6">
        <UserForm
          mode="create"
          action={createUserAction}
          locations={locations}
          departments={departments}
          returnTo={returnTo}
          employeeOnly={session.role === "support"}
          showActions={!embedded}
        />
      </Card>
    </div>
  );
}
