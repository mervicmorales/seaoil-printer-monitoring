import { Input } from "@/components/ui";

export default function ReplacementForm({
  oldSerialNumber,
  model,
  today,
}: {
  oldSerialNumber: string;
  model: string;
  today: string;
}) {
  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Replacement Date" floatingLabel name="replacementDate" type="date" defaultValue={today} />
        <Input
          label="Current Serial Number"
          floatingLabel
          value={oldSerialNumber}
          readOnly
          disabled
          className="bg-slate-100 text-slate-500"
        />
        <Input label="New Serial Number" floatingLabel name="newSerialNumber" placeholder="Enter new serial number" />
        <Input label="Replacement Model" floatingLabel name="replacementModel" defaultValue={model} />
      </div>
      <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3.5 py-2.5 text-xs leading-5 text-slate-600">
        Leave the new serial number empty when no replacement is being recorded.
      </div>
    </div>
  );
}
