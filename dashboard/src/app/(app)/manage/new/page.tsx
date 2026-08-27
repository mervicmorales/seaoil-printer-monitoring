import { PageHeader, Card } from "@/components/ui";
import UserForm from "../UserForm";
import { createUserAction } from "../actions";
import { requireAdmin } from "@/lib/server-utils";

export default async function NewUserPage() {
  await requireAdmin();
  return (
    <div>
      <PageHeader title="Add User" subtitle="Create a new user account." />
      <Card className="p-6">
        <UserForm mode="create" action={createUserAction} />
      </Card>
    </div>
  );
}
