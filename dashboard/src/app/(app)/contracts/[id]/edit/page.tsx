import { notFound } from "next/navigation";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import { getVendors } from "@/lib/lookups";
import ContractForm from "../../ContractForm";
import { updateContractAction } from "../../actions";
import { requireAdmin } from "@/lib/server-utils";

export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const rows = await db.select().from(contracts).where(eq(contracts.id, Number(id))).limit(1);
  const contract = rows[0];
  if (!contract) notFound();
  const vendors = await getVendors();

  return (
    <div>
      <PageHeader title="Update Contract" subtitle={`Contract Number: ${contract.contractNumber}`} />
      <Card className="p-6">
        <ContractForm mode="edit" action={updateContractAction} contract={contract} vendors={vendors} />
      </Card>
    </div>
  );
}
