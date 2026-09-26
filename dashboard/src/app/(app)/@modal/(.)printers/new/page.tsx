import { NewPrinterPage } from "@/app/(app)/printers/new/content";
import ModalShell from "@/components/ModalShell";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";

export default async function NewPrinterModal({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const returnTo = normalizePrinterReturnTo(
    typeof resolvedSearchParams.returnTo === "string" ? resolvedSearchParams.returnTo : null,
  );

  return (
    <ModalShell
      title="Add printer"
      closeHref={returnTo}
      showTitle={false}
      pageHeaderInModal
      variant="right-panel"
    >
      <NewPrinterPage
        searchParams={Promise.resolve(resolvedSearchParams)}
        embedded
      />
    </ModalShell>
  );
}
