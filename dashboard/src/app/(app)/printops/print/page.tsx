import { PrintOpsPrintPageContent } from "./PrintOpsPrintPageContent";

export const dynamic = "force-dynamic";

export default function PrintOpsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  return <PrintOpsPrintPageContent searchParams={searchParams} />;
}
