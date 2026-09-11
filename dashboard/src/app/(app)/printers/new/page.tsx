import { PageHeader, Card, PrimaryButton } from "@/components/ui";
import {
  getContracts,
  getDepartments,
  getLocations,
  getProvisionedMonitoringAgents,
  getTonerTypes,
  getVendors,
} from "@/lib/lookups";
import PrinterForm from "../PrinterForm";
import { createPrinterAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";
import CreatePrinterStatusSelect from "./CreatePrinterStatusSelect";

export default async function NewPrinterPage({
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
  const [tonerTypes, locations, departments, vendors, contracts, monitoringAgents] = await Promise.all([
    getTonerTypes(),
    getLocations(),
    getDepartments(),
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
          <div className="flex flex-wrap items-end gap-2">
            <CreatePrinterStatusSelect formId="printer-create-form" compact />
            <PrimaryButton
              type="submit"
              form="printer-create-form"
              className="px-3 py-1.5 text-xs"
            >
              Add Printer
            </PrimaryButton>
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
            monthlyRate: "0",
            locationId: null,
            departmentId: null,
            vendorId: null,
            contractId: null,
            assignedUser: null,
            status: "Active",
            monitoringEnabled: monitoringAgentId !== null,
            monitoringAgentId,
          }}
          tonerTypes={tonerTypes}
          locations={locations}
          departments={departments}
          vendors={vendors}
          contracts={contracts}
          monitoringAgents={monitoringAgents}
          returnTo={returnTo}
          showActions={!embedded}
        />
      </Card>
    </div>
  );
}
