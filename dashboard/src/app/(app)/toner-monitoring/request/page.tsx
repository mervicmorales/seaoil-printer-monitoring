import { PageHeader, Card, PrimaryButton } from "@/components/ui";
import { getDepartments, getItsNames, getLocations, getTonerTypesWithInventory } from "@/lib/lookups";
import { createRequestAction } from "../actions";
import TonerDeliveryRequestForm from "../TonerDeliveryRequestForm";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export default async function RequestTonerPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  await requireModuleFullAccess("toner");
  const [tonerTypes, locations, departments, itsNames] = await Promise.all([
    getTonerTypesWithInventory(),
    getLocations(),
    getDepartments(),
    getItsNames(),
  ]);

  return (
    <div>
      <PageHeader
        title="Request Toner"
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="toner-request-form"
            className="px-3 py-1.5 text-xs"
          >
            Save Request
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-6">
        <TonerDeliveryRequestForm
          mode="request"
          action={createRequestAction}
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
