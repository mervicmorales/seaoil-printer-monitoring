import RegistrationDetailPage from "@/app/(app)/manage/registrations/[id]/page";
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
      title="Registration Detail"
      closeHref="/manage/registrations"
      showTitle={false}
      pageHeaderInModal
      contentClassName="overflow-x-hidden"
    >
      <RegistrationDetailPage params={params} searchParams={searchParams} />
    </ModalShell>
  );
}
