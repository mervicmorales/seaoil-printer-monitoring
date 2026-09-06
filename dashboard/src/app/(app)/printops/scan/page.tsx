import { PrintOpsScanPageContent } from "./PrintOpsScanPageContent";

export const dynamic = "force-dynamic";

export default function PrintOpsScanPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  return <PrintOpsScanPageContent searchParams={searchParams} />;
}
