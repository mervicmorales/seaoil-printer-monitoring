import { EditUserPage } from "@/app/(app)/manage/[id]/edit/content";
import ModalShell from "@/components/ModalShell";

export default async function EditUserModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ModalShell
      title="Edit User"
      closeHref={`/manage/users/${id}`}
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      variant="right-panel"
      panelClassName="max-w-[48rem] !bg-app-surface sm:m-3 sm:!h-[calc(100dvh-1.5rem)] sm:rounded-3xl sm:border sm:border-app-border"
      contentClassName="flex-1 !overflow-x-hidden !overflow-y-auto !bg-app-surface !p-4 sm:!p-5"
      closeButtonClassName="!rounded-full !border-transparent !bg-app-surface-subtle !shadow-none hover:!bg-app-surface-raised"
    >
      <EditUserPage params={Promise.resolve({ id })} embedded />
    </ModalShell>
  );
}
