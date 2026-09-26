import { EditPrinterPage } from "./content";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  return <EditPrinterPage params={params} searchParams={searchParams} />;
}
