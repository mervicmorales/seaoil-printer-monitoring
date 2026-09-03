import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { PackageCheck } from "lucide";
import { getDepartments, getItsNames, getLocations, getTonerTypes } from "@/lib/lookups";
import { createDeliveryAction } from "../actions";
import TonerDeliveryRequestForm from "../TonerDeliveryRequestForm";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export default async function DeliveryTonerPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  await requireModuleFullAccess("toner");
  const [tonerTypes, locations, departments, itsNames] = await Promise.all([
    getTonerTypes(),
    getLocations(),
    getDepartments(),
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
            className="px-3 py-1.5 text-xs"
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
          locations={locations}
          departments={departments}
          itsNames={itsNames}
          today={todayISO()}
          showActions={!embedded}
        />
      </Card>
    </div>
  );
}
