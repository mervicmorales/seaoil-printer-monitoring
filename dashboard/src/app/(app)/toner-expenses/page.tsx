import { ReceiptText } from "lucide";
import { Card, IconGlyph, PageHeader } from "@/components/ui";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function TonerExpensesPage() {
  await requireModuleFullAccess("toner_expenses");

  return (
    <div>
      <PageHeader
        title="Toner Expenses"
        subtitle="Review and manage toner-related expenses."
      />
      <Card className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <IconGlyph icon={ReceiptText} size={22} />
        </span>
        <p className="mt-4 text-sm font-semibold text-slate-700">No toner expense records yet</p>
        <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">
          This page is ready for the toner expense workflow when it is added.
        </p>
      </Card>
    </div>
  );
}
