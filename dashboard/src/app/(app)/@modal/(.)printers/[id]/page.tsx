import PrinterViewPage from "@/app/(app)/printers/[id]/page";
import ModalShell from "@/components/ModalShell";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";

export default async function PrinterViewModal({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; returnTo?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const returnTo = normalizePrinterReturnTo(resolvedSearchParams.returnTo);

  return (
    <ModalShell title="Printer Details" closeHref={returnTo}>
      <PrinterViewPage params={params} searchParams={Promise.resolve(resolvedSearchParams)} />
    </ModalShell>
  );
}
