import { PageHeader, Card } from "@/components/ui";
import {
  getContracts,
  getProvisionedMonitoringAgents,
  getTonerTypes,
  getVendors,
} from "@/lib/lookups";
import { getOrganizationOptions } from "@/lib/organization";
import PrinterForm from "../PrinterForm";
import { createPrinterAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";
import CreatePrinterStatusSelect from "./CreatePrinterStatusSelect";

export async function NewPrinterPage({
  searchParams,
  embedded = false,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  embedded?: boolean;
}) {
  await requireModuleFullAccess("printer_records");
  const params = (await searchParams) ?? {};
  const value = (name: string, maxLength: number) => {
    const candidate = params[name];
    return typeof candidate === "string" ? candidate.trim().slice(0, maxLength) : "";
  };
  const parsedAgentId = Number(value("monitoringAgentId", 20));
  const monitoringAgentId = Number.isSafeInteger(parsedAgentId) && parsedAgentId > 0
    ? parsedAgentId
    : null;
  const returnTo = normalizePrinterReturnTo(
    typeof params.returnTo === "string" ? params.returnTo : null,
  );
  const [tonerTypes, organizationOptions, vendors, contracts, monitoringAgents] = await Promise.all([
    getTonerTypes(),
    getOrganizationOptions(),
    getVendors(),
    getContracts(),
    getProvisionedMonitoringAgents(),
  ]);

  return (
    <div>
      <PageHeader
        title="Add Printer"
        subtitle="Register a new printer asset into the monitoring system."
        actions={embedded ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <CreatePrinterStatusSelect formId="printer-create-form" compact />
          </div>
        ) : (
          <CreatePrinterStatusSelect formId="printer-create-form" />
        )}
      />
      <Card className="p-6">
        <PrinterForm
          mode="create"
          action={createPrinterAction}
          printer={{
            id: 0,
            assetTag: null,
            ipAddress: value("ip", 20) || null,
            macAddress: value("macAddress", 17) || null,
            serialNumber: value("serial", 255),
            model: value("model", 255) || null,
            monthlyRate: null,
            floor: null,
            locationId: null,
            departmentId: null,
            subunitId: null,
            costCenterId: null,
            vendorId: null,
            contractId: null,
            assignedUser: null,
            status: "Active",
            monitoringEnabled: monitoringAgentId !== null,
            monitoringAgentId,
          }}
          tonerTypes={tonerTypes}
          organizationOptions={organizationOptions}
          vendors={vendors}
          contracts={contracts}
          monitoringAgents={monitoringAgents}
          returnTo={returnTo}
          showActions
        />
      </Card>
    </div>
  );
}
