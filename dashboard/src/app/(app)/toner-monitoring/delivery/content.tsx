import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { PackageCheck } from "lucide";
import { getItsNames, getVisibleTonerTypes } from "@/lib/lookups";
import { getOrganizationOptions } from "@/lib/organization";
import { createPurchaseAction } from "../actions";
import TonerDeliveryRequestForm from "../TonerDeliveryRequestForm";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export async function PurchaseTonerPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  await requireModuleFullAccess("toner_monitoring");
  const [tonerTypes, organizationOptions, itsNames] = await Promise.all([
    getVisibleTonerTypes(),
    getOrganizationOptions(),
    getItsNames(),
  ]);

  return (
    <div>
      <PageHeader
        title="Purchase Toner"
        subtitle="Record a toner purchase before it is delivered."
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="toner-purchase-form"
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
          >
            <IconGlyph icon={PackageCheck} size={14} />
            Save Purchase
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-5 sm:p-6">
        <TonerDeliveryRequestForm
          mode="purchase"
          action={createPurchaseAction}
          tonerTypes={tonerTypes}
          organizationOptions={organizationOptions}
          itsNames={itsNames}
          today={todayISO()}
          showActions={!embedded}
        />
      </Card>
    </div>
  );
}
