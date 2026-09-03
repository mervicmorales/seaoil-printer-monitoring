import EditUserPage from "@/app/(app)/manage/[id]/edit/page";
import ModalShell from "@/components/ModalShell";

export default function EditUserModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ModalShell
      title="Edit User"
      closeHref="/manage"
      showTitle={false}
      pageHeaderInModal
      hideScrollbar
      contentClassName="overflow-x-hidden"
    >
      <EditUserPage params={params} embedded />
    </ModalShell>
  );
}
