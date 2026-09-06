import { PrintOpsPrintPageContent } from "@/app/(app)/printops/print/PrintOpsPrintPageContent";

export const dynamic = "force-dynamic";

export default function EmployeePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  return (
    <PrintOpsPrintPageContent
      searchParams={searchParams}
      employeeMode
    />
  );
}
