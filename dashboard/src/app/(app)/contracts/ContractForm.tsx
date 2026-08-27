"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input, Select, Textarea, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { ContractFormState } from "./actions";
import Link from "next/link";

type Lookup = { id: number; name: string };
type Contract = {
  id: number;
  contractNumber: string;
  vendorId: number | null;
  startDate: string | null;
  endDate: string | null;
  documentName: string | null;
  notes: string | null;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </PrimaryButton>
  );
}

export default function ContractForm({
  mode,
  action,
  contract,
  vendors,
}: {
  mode: "create" | "edit";
  action: (prev: ContractFormState, formData: FormData) => Promise<ContractFormState>;
  contract?: Contract;
  vendors: Lookup[];
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {mode === "edit" && contract && <input type="hidden" name="id" value={contract.id} />}
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input
          label="Contract Number"
          name="contractNumber"
          required={mode === "create"}
          defaultValue={contract?.contractNumber ?? ""}
          readOnly={mode === "edit"}
          disabled={mode === "edit"}
          className={mode === "edit" ? "bg-slate-100 text-slate-500" : ""}
          error={state.fieldErrors?.contractNumber}
        />
        <Select label="Vendor / Supplier" name="vendorId" defaultValue={contract?.vendorId ?? ""}>
          <option value="">Select vendor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
        <Input label="Contract Start" name="startDate" type="date" defaultValue={contract?.startDate ?? ""} />
        <Input label="Contract End / Renewal" name="endDate" type="date" defaultValue={contract?.endDate ?? ""} />
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Contract Document</label>
          <input type="file" name="document" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm" />
          {contract?.documentName && <p className="mt-1 text-xs text-slate-500">Current file: {contract.documentName}</p>}
        </div>
        <div className="sm:col-span-2">
          <Textarea label="Notes" name="notes" rows={4} defaultValue={contract?.notes ?? ""} />
        </div>
      </div>
      <div className="flex gap-3">
        <SubmitButton label={mode === "create" ? "Upload Contract" : "Save Changes"} />
        <Link href="/contracts"><SecondaryButton type="button">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}
