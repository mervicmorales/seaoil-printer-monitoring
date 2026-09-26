import { RegistrationDetailPage } from "./content";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  return <RegistrationDetailPage params={params} searchParams={searchParams} />;
}
