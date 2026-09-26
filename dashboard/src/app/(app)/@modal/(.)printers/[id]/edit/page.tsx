import { EditPrinterPage } from "@/app/(app)/printers/[id]/edit/content";
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
  const { id } = await params;
  const returnTo = normalizePrinterReturnTo(resolvedSearchParams.returnTo);
  const detailsHref = `/printers/${id}?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <ModalShell
      title="Edit printer"
      closeHref={detailsHref}
      showTitle={false}
      pageHeaderInModal
      variant="right-panel"
    >
      <EditPrinterPage
        params={Promise.resolve({ id })}
        searchParams={Promise.resolve(resolvedSearchParams)}
        embedded
      />
    </ModalShell>
  );
}
