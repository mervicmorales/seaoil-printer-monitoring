import { PrinterViewPage } from "./content";

export const dynamic = "force-dynamic";

export default function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; returnTo?: string }>;
}) {
  return <PrinterViewPage params={params} searchParams={searchParams} />;
}
