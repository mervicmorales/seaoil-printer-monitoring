import { PageHeader, Card } from "@/components/ui";
import { getDepartments, getItsNames, getLocations, getTonerTypesWithInventory } from "@/lib/lookups";
import { createRequestAction } from "../actions";
import TonerDeliveryRequestForm from "../TonerDeliveryRequestForm";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export default async function RequestTonerPage() {
  await requireModuleFullAccess("toner");
  const [tonerTypes, locations, departments, itsNames] = await Promise.all([
    getTonerTypesWithInventory(),
    getLocations(),
    getDepartments(),
    getItsNames(),
  ]);

  return (
    <div>
      <PageHeader title="Request Toner" subtitle="Record a toner request/issuance. Quantity subtracts from inventory." />
      <Card className="p-6">
        <TonerDeliveryRequestForm
          mode="request"
          action={createRequestAction}
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
