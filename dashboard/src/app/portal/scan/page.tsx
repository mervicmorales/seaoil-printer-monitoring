import { PrintOpsScanPageContent } from "@/app/(app)/printops/scan/PrintOpsScanPageContent";

export const dynamic = "force-dynamic";

export default function EmployeeScanPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  return (
    <PrintOpsScanPageContent
      searchParams={searchParams}
      employeeMode
    />
  );
}
