import { PageHeader, Card } from "@/components/ui";
import UserForm from "../UserForm";
import { createUserAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { getDepartments, getLocations } from "@/lib/lookups";

export default async function NewUserPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireModuleFullAccess("manage_users");
  const params = (await searchParams) ?? {};
  const returnTo = params.returnTo === "/manage/registrations" ? "/manage/registrations" : "/manage";
  const [locations, departments] = await Promise.all([getLocations(), getDepartments()]);
  return (
    <div>
      <PageHeader title="Create Account" subtitle="Create a new user account." />
      <Card className="p-6">
        <UserForm mode="create" action={createUserAction} locations={locations} departments={departments} returnTo={returnTo} employeeOnly={session.role === "support"} />
      </Card>
    </div>
  );
}
