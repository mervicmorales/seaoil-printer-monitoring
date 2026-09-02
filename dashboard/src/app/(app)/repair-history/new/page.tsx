import { PageHeader, Card, PrimaryButton } from "@/components/ui";
import { getDepartments, getLocations, getVendors } from "@/lib/lookups";
import ReportIssueForm from "../ReportIssueForm";
import { createReportAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export default async function ReportIssuePage({ embedded = false }: { embedded?: boolean }) {
  await requireModuleFullAccess("repair");
  const [locations, departments, vendors] = await Promise.all([getLocations(), getDepartments(), getVendors()]);

  return (
    <div>
      <PageHeader
        title="Report Printer Issue"
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="report-printer-issue-form"
            className="px-3 py-1.5 text-xs"
          >
            Submit Report
          </PrimaryButton>
        ) : undefined}
      />
      <Card className="p-6">
        <ReportIssueForm
          action={createReportAction}
          locations={locations}
          departments={departments}
          vendors={vendors}
          today={todayISO()}
          showActions={!embedded}
        />
      </Card>
    </div>
  );
}
