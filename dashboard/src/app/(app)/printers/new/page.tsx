import { PageHeader, Card } from "@/components/ui";
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
import CreatePrinterStatusSelect from "./CreatePrinterStatusSelect";

export default async function NewPrinterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireModuleFullAccess("printers");
  const params = (await searchParams) ?? {};
  const value = (name: string, maxLength: number) => {
    const candidate = params[name];
    return typeof candidate === "string" ? candidate.trim().slice(0, maxLength) : "";
  };
  const parsedAgentId = Number(value("monitoringAgentId", 20));
  const monitoringAgentId = Number.isSafeInteger(parsedAgentId) && parsedAgentId > 0
    ? parsedAgentId
    : null;
  const returnTo = typeof params.returnTo === "string" ? params.returnTo : "/printers";
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
        actions={<CreatePrinterStatusSelect formId="printer-create-form" />}
      />
      <Card className="p-6">
        <PrinterForm
          mode="create"
          action={createPrinterAction}
          printer={{
            id: 0,
            assetTag: null,
            ipAddress: value("ip", 20) || null,
            serialNumber: value("serial", 255),
            brand: value("brand", 255) || null,
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
        />
      </Card>
    </div>
  );
}
