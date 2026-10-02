import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { Send } from "lucide";
import { getItsNames, getVisibleTonerTypesWithInventory } from "@/lib/lookups";
import { getOrganizationOptions } from "@/lib/organization";
import { createRequestAction } from "../actions";
import TonerDeliveryRequestForm from "../TonerDeliveryRequestForm";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export async function RequestTonerPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  await requireModuleFullAccess("toner_monitoring");
  const [tonerTypes, organizationOptions, itsNames] = await Promise.all([
    getVisibleTonerTypesWithInventory(),
    getOrganizationOptions(),
    getItsNames(),
  ]);

  return (
    <div>
      <PageHeader
        title="Request Toner"
        subtitle="Record toner issued to an office or department."
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="toner-request-form"
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
          >
            <IconGlyph icon={Send} size={14} />
            Save Request
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-5 sm:p-6">
        <TonerDeliveryRequestForm
          mode="request"
          action={createRequestAction}
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
