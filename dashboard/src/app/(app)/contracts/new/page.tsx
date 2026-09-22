import { FileUp } from "lucide";
import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { getVendors } from "@/lib/lookups";
import ContractForm from "../ContractForm";
import { createContractAction } from "../actions";
import { requireAdmin } from "@/lib/server-utils";

export default async function NewContractPage({ embedded = false }: { embedded?: boolean }) {
  await requireAdmin("contract");
  const vendors = await getVendors();
  return (
    <div className={embedded ? "h-full" : ""}>
      <PageHeader
        title="Upload Contract"
        subtitle="Add a new printer service contract to the repository."
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="contract-create-form"
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
          >
            <IconGlyph icon={FileUp} size={14} />
            Upload Contract
          </PrimaryButton>
        ) : undefined}
      />
      <Card className={embedded ? "flex h-full min-h-0 flex-col p-4 sm:p-5" : "p-6"}>
        <ContractForm mode="create" action={createContractAction} vendors={vendors} showActions={!embedded} />
      </Card>
    </div>
  );
}
