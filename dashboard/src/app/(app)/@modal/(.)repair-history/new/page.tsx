import ReportIssuePage from "@/app/(app)/repair-history/new/page";
import ModalShell from "@/components/ModalShell";

export default function ReportPrinterIssueModal() {
  return (
    <ModalShell title="Report printer issue" closeHref="/repair-history" showTitle={false}>
      <ReportIssuePage />
    </ModalShell>
  );
}
