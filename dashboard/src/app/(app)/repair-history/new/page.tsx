import { PageHeader, Card } from "@/components/ui";
import { getDepartments, getLocations, getVendors } from "@/lib/lookups";
import ReportIssueForm from "../ReportIssueForm";
import { createReportAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export default async function ReportIssuePage() {
  await requireModuleFullAccess("repair");
  const [locations, departments, vendors] = await Promise.all([getLocations(), getDepartments(), getVendors()]);

  return (
    <div>
      <PageHeader title="Report Printer Issue" />
      <Card className="p-6">
        <ReportIssueForm action={createReportAction} locations={locations} departments={departments} vendors={vendors} today={todayISO()} />
      </Card>
    </div>
  );
}
