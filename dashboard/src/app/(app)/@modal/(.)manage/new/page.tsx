import NewUserPage from "@/app/(app)/manage/new/page";
import ModalShell from "@/components/ModalShell";

export default async function NewUserModal({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const returnTo = params.returnTo === "/manage/registrations" ? "/manage/registrations" : "/manage";
  return (
    <ModalShell
      title="Create Account"
      closeHref={returnTo}
      showTitle={false}
      pageHeaderInModal
      contentClassName="overflow-x-hidden"
    >
      <NewUserPage searchParams={Promise.resolve(params)} embedded />
    </ModalShell>
  );
}
