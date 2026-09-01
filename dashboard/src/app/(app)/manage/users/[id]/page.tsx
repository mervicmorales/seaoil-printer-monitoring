import ViewUserPage from "@/app/(app)/manage/[id]/page";

export default function UserDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ViewUserPage params={params} />;
}
