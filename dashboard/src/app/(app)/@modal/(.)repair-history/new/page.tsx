import { ReportIssuePage } from "@/app/(app)/repair-history/new/content";
import ModalShell from "@/components/ModalShell";

export default function ReportPrinterIssueModal() {
  return (
    <ModalShell
      title="Report Printer Issue"
      closeHref="/repair-history"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      variant="right-panel"
      panelClassName="max-w-[48rem] !bg-white sm:m-3 sm:!h-[calc(100dvh-1.5rem)] sm:rounded-3xl sm:border sm:border-slate-200"
      contentClassName="flex-1 !overflow-x-hidden !overflow-y-auto !bg-white !p-4 sm:!p-5"
      closeButtonClassName="!rounded-full !border-transparent !bg-slate-100 !shadow-none hover:!bg-slate-200"
    >
      <ReportIssuePage embedded />
    </ModalShell>
  );
}
