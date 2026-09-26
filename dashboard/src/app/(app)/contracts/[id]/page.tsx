import { ViewContractPage } from "./content";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ serial?: string }>;
}) {
  return <ViewContractPage params={params} searchParams={searchParams} />;
}
