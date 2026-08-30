import { PageHeader, Card } from "@/components/ui";
import UserForm from "../UserForm";
import { createUserAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { getDepartments, getLocations } from "@/lib/lookups";

export default async function NewUserPage() {
  await requireModuleFullAccess("manage_users");
  const [locations, departments] = await Promise.all([getLocations(), getDepartments()]);
  return (
    <div>
      <PageHeader title="Add User" subtitle="Create a new user account." />
      <Card className="p-6">
        <UserForm mode="create" action={createUserAction} locations={locations} departments={departments} />
      </Card>
    </div>
  );
}
