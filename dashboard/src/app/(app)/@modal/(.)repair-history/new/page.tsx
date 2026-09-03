import ReportIssuePage from "@/app/(app)/repair-history/new/page";
import ModalShell from "@/components/ModalShell";

export default function ReportPrinterIssueModal() {
  return (
    <ModalShell
      title="Report Printer Issue"
      closeHref="/repair-history"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
    >
      <ReportIssuePage embedded />
    </ModalShell>
  );
}
