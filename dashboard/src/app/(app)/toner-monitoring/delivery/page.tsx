import { PageHeader, Card } from "@/components/ui";
import { getDepartments, getItsNames, getLocations, getTonerTypes } from "@/lib/lookups";
import { createDeliveryAction } from "../actions";
import TonerDeliveryRequestForm from "../TonerDeliveryRequestForm";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export default async function DeliveryTonerPage() {
  await requireModuleFullAccess("toner");
  const [tonerTypes, locations, departments, itsNames] = await Promise.all([
    getTonerTypes(),
    getLocations(),
    getDepartments(),
    getItsNames(),
  ]);

  return (
    <div>
      <PageHeader title="Delivery Toner" subtitle="Record toner deliveries received. Quantity adds to inventory." />
      <Card className="p-6">
        <TonerDeliveryRequestForm
          mode="delivery"
          action={createDeliveryAction}
          tonerTypes={tonerTypes}
          locations={locations}
          departments={departments}
          itsNames={itsNames}
          today={todayISO()}
        />
      </Card>
    </div>
  );
}
