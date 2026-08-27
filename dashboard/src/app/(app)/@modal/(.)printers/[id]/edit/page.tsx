import EditPrinterPage from "@/app/(app)/printers/[id]/edit/page";
import ModalShell from "@/components/ModalShell";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";

export default async function EditPrinterModal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const returnTo = normalizePrinterReturnTo(resolvedSearchParams.returnTo);

  return (
    <ModalShell title="Edit printer" closeHref={returnTo} showTitle={false}>
      <EditPrinterPage params={params} searchParams={Promise.resolve(resolvedSearchParams)} />
    </ModalShell>
  );
}
