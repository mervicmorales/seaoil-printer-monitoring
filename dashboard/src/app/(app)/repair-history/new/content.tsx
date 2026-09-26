import { PageHeader, Card, IconGlyph, PrimaryButton } from "@/components/ui";
import { Send } from "lucide";
import { getDepartments, getLocations, getVendors } from "@/lib/lookups";
import ReportIssueForm from "../ReportIssueForm";
import { createReportAction } from "../actions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { todayISO } from "@/lib/format";

export async function ReportIssuePage({ embedded = false }: { embedded?: boolean }) {
  await requireModuleFullAccess("repair");
  const [locations, departments, vendors] = await Promise.all([getLocations(), getDepartments(), getVendors()]);

  return (
    <div>
      <PageHeader
        title="Report Printer Issue"
        subtitle="Create a repair ticket for a printer requiring service."
        actions={embedded ? (
          <PrimaryButton
            type="submit"
            form="report-printer-issue-form"
            className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none"
          >
            <IconGlyph icon={Send} size={14} />
            Submit Report
          </PrimaryButton>
        ) : undefined}
      />
      <Card className={embedded ? "!border-0 p-0" : "p-5 sm:p-6"}>
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
