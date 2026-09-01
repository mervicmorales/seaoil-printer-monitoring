import EditUserPage from "@/app/(app)/manage/[id]/edit/page";
import ModalShell from "@/components/ModalShell";

export default function EditUserModal({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <ModalShell title="Edit User" closeHref="/manage" showTitle={false}>
      <EditUserPage params={params} />
    </ModalShell>
  );
}
