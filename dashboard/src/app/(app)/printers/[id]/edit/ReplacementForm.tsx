"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Input, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { PrinterFormState } from "../../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Replacement"}
    </PrimaryButton>
  );
}

export default function ReplacementForm({
  action,
  printerId,
  oldSerialNumber,
  brand,
  model,
  today,
  returnTo,
}: {
  action: (prev: PrinterFormState, formData: FormData) => Promise<PrinterFormState>;
  printerId: number;
  oldSerialNumber: string;
  brand: string;
  model: string;
  today: string;
  returnTo: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="printerId" value={printerId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Replacement Date" name="replacementDate" type="date" defaultValue={today} required />
        <Input
          label="OLD Serial Number"
          value={oldSerialNumber}
          readOnly
          disabled
          className="bg-slate-100 text-slate-500"
        />
        <Input label="New Serial Number" name="newSerialNumber" placeholder="Enter new serial number" required />
        <Input label="Brand" name="brand" defaultValue={brand} />
        <Input label="Model" name="model" defaultValue={model} />
      </div>
      <div className="flex gap-3">
        <SubmitButton />
        <Link href={`/printers/${printerId}?returnTo=${encodeURIComponent(returnTo)}`}>
          <SecondaryButton type="button">Cancel</SecondaryButton>
        </Link>
      </div>
    </form>
  );
}
