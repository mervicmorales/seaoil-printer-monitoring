import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { PackageCheck } from "lucide";
import { getItsNames, getVisibleTonerTypes } from "@/lib/lookups";
import { getOrganizationOptions } from "@/lib/organization";
import { createDeliveryAction } from "../actions";
import TonerDeliveryRequestForm from "../TonerDeliveryRequestForm";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export async function DeliveryTonerPage({
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
        title="Add Toner"
        subtitle="Record toner stock received from a delivery."
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="toner-delivery-form"
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
          >
            <IconGlyph icon={PackageCheck} size={14} />
            Save Delivery
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-5 sm:p-6">
        <TonerDeliveryRequestForm
          mode="delivery"
          action={createDeliveryAction}
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
