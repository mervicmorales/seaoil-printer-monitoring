import { notFound } from "next/navigation";
import { db } from "@/db";
import { tonerTransactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Save } from "lucide";
import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { getDepartments, getItsNames, getLocations, getTonerTypes } from "@/lib/lookups";
import EditTransactionForm from "./EditTransactionForm";
import { updateTransactionAction } from "../../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";

export async function EditTransactionPage({ params, embedded = false }: { params: Promise<{ id: string }>; embedded?: boolean }) {
  await requireModuleFullAccess("toner_monitoring");
  const { id } = await params;
  const rows = await db.select().from(tonerTransactions).where(eq(tonerTransactions.id, Number(id))).limit(1);
  const txn = rows[0];
  if (!txn) notFound();

  const [tonerTypes, locations, departments, itsNames] = await Promise.all([
    getTonerTypes(),
    getLocations(),
    getDepartments(),
    getItsNames(),
  ]);

  return (
    <div>
      <PageHeader
        title="Edit Toner Transaction"
        subtitle="Update transaction details. Inventory is recalculated automatically."
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="toner-transaction-edit-form"
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
          >
            <IconGlyph icon={Save} size={14} />
            Save Changes
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-5 sm:p-6">
        <EditTransactionForm
          action={updateTransactionAction}
          txn={txn}
          tonerTypes={tonerTypes}
          locations={locations}
          departments={departments}
          itsNames={itsNames}
          showActions={!embedded}
        />
      </Card>
    </div>
  );
}
