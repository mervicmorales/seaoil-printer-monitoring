"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input, Textarea, PrimaryButton } from "@/components/ui";
import SearchableSelect from "@/components/SearchableSelect";
import type { ContractFormState } from "./actions";

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
  showActions = true,
}: {
  mode: "create" | "edit";
  action: (prev: ContractFormState, formData: FormData) => Promise<ContractFormState>;
  contract?: Contract;
  vendors: Lookup[];
  showActions?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form
      id={mode === "create" ? "contract-create-form" : "contract-edit-form"}
      action={formAction}
      className={showActions ? "space-y-6" : "flex h-full min-h-0 flex-col"}
    >
      {mode === "edit" && contract && <input type="hidden" name="id" value={contract.id} />}
      {state.error && (
        <div role="alert" className={`rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 ${showActions ? "" : "mb-3"}`}>{state.error}</div>
      )}
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${showActions ? "gap-x-5 gap-y-4" : "min-h-0 flex-1 gap-x-4 gap-y-3 sm:grid-rows-[auto_auto_auto_minmax(6rem,1fr)]"}`}>
        <Input
          label="Contract Number"
          floatingLabel
          name="contractNumber"
          required={mode === "create"}
          defaultValue={contract?.contractNumber ?? ""}
          readOnly={mode === "edit"}
          disabled={mode === "edit"}
          className={mode === "edit" ? "bg-slate-100 text-slate-500" : ""}
          error={state.fieldErrors?.contractNumber}
        />
        <SearchableSelect
          label="Vendor / Supplier"
          floatingLabel
          name="vendorId"
          options={vendors}
          placeholder="Search vendor or supplier..."
          defaultValue={contract?.vendorId}
        />
        <Input label="Contract Start" floatingLabel name="startDate" type="date" defaultValue={contract?.startDate ?? ""} />
        <Input label="Contract End / Renewal" floatingLabel name="endDate" type="date" defaultValue={contract?.endDate ?? ""} />
        <div className={`border-t border-slate-200 sm:col-span-2 ${showActions ? "pt-5" : "pt-3"}`}>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Contract Document</label>
          <input
            type="file"
            name="document"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            className={`w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3.5 text-sm text-slate-600 transition file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-[#014171] file:px-3 file:text-xs file:font-semibold file:text-white hover:border-slate-400 hover:bg-slate-50/80 ${showActions ? "py-3 file:py-2" : "py-2 file:py-1.5"}`}
          />
          <div className="mt-2 flex flex-col gap-1 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>PDF, DOC, DOCX, PNG, JPG, or JPEG</span>
            {contract?.documentName && (
              <span className="max-w-full truncate font-medium text-slate-600 sm:max-w-[55%]" title={contract.documentName}>
                Current: {contract.documentName}
              </span>
            )}
          </div>
        </div>
        <div className={`sm:col-span-2 ${showActions ? "" : "min-h-0 [&>div]:h-full [&_textarea]:h-[calc(100%-1.75rem)] [&_textarea]:min-h-20 [&_textarea]:resize-none"}`}>
          <Textarea label="Notes" name="notes" rows={showActions ? 4 : 3} defaultValue={contract?.notes ?? ""} />
        </div>
      </div>
      <div className={showActions ? "flex border-t border-slate-200 pt-5 sm:justify-end" : "hidden"}>
        <SubmitButton label={mode === "create" ? "Upload Contract" : "Save Changes"} />
      </div>
    </form>
  );
}
