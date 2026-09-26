import { notFound } from "next/navigation";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { FileText, Save } from "lucide";
import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { getVendors } from "@/lib/lookups";
import ContractForm from "../../ContractForm";
import { updateContractAction } from "../../actions";
import { requireAdmin } from "@/lib/server-utils";

export async function EditContractPage({ params, embedded = false }: { params: Promise<{ id: string }>; embedded?: boolean }) {
  await requireAdmin("contract");
  const { id } = await params;
  const rows = await db.select().from(contracts).where(eq(contracts.id, Number(id))).limit(1);
  const contract = rows[0];
  if (!contract) notFound();
  const vendors = await getVendors();

  return (
    <div className={embedded ? "h-full" : ""}>
      <PageHeader
        title="Update Contract"
        subtitle={`Contract Number: ${contract.contractNumber}`}
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="contract-edit-form"
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
          >
            <IconGlyph icon={Save} size={14} />
            Save Changes
          </PrimaryButton>
        ) : undefined}
      />
      <Card className={embedded ? "flex h-full min-h-0 flex-col overflow-hidden" : "overflow-hidden"}>
        <div className={`flex shrink-0 items-center gap-3 border-b border-slate-200 bg-slate-50/70 ${embedded ? "px-4 py-3" : "px-5 py-4"}`}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-[#014171]">
            <IconGlyph icon={FileText} size={17} />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-800">Contract information</h2>
            <p className="mt-0.5 text-xs text-slate-500">Update the supplier, coverage dates, document, or notes.</p>
          </div>
        </div>
        <div className={embedded ? "min-h-0 flex-1 p-4 sm:p-5" : "p-5 sm:p-6"}>
          <ContractForm
            mode="edit"
            action={updateContractAction}
            contract={contract}
            vendors={vendors}
            showActions={!embedded}
          />
        </div>
      </Card>
    </div>
  );
}
