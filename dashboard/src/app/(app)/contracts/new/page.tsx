import { PageHeader, Card } from "@/components/ui";
import { getVendors } from "@/lib/lookups";
import ContractForm from "../ContractForm";
import { createContractAction } from "../actions";
import { requireAdmin } from "@/lib/server-utils";

export default async function NewContractPage() {
  await requireAdmin("contract");
  const vendors = await getVendors();
  return (
    <div>
      <PageHeader title="Upload Contract" subtitle="Add a new printer service contract to the repository." />
      <Card className="p-6">
        <ContractForm mode="create" action={createContractAction} vendors={vendors} />
      </Card>
    </div>
  );
}
