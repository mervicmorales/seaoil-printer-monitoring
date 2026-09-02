import { PageHeader, Card, PrimaryButton } from "@/components/ui";
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
        title="Delivery Toner"
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="toner-delivery-form"
            className="px-3 py-1.5 text-xs"
          >
            Save Delivery
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-6">
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
