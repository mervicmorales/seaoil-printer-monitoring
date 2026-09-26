import { ViewUserPage } from "./content";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
}) {
  return <ViewUserPage params={params} searchParams={searchParams} />;
}
