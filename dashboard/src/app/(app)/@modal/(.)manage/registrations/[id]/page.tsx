import { RegistrationDetailPage } from "@/app/(app)/manage/registrations/[id]/content";
import ModalShell from "@/components/ModalShell";

export default function RegistrationDetailModal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  return (
    <ModalShell
      title="Registration Details"
      closeHref="/manage/registrations"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      variant="right-panel"
      panelClassName="max-w-[48rem] !bg-white sm:m-3 sm:!h-[calc(100dvh-1.5rem)] sm:rounded-3xl sm:border sm:border-slate-200"
      contentClassName="flex-1 !overflow-x-hidden !overflow-y-auto !bg-white !p-4 sm:!p-5"
      closeButtonClassName="!rounded-full !border-transparent !bg-slate-100 !shadow-none hover:!bg-slate-200"
    >
      <RegistrationDetailPage params={params} searchParams={searchParams} embedded />
    </ModalShell>
  );
}
