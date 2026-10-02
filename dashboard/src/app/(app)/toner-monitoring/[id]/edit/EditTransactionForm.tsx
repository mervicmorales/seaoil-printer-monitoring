"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardList, Pencil, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, PrimaryButton, Textarea } from "@/components/ui";
import SearchableSelect from "@/components/SearchableSelect";
import SearchableDropdown from "@/components/SearchableDropdown";
import OrganizationFields, { type OrganizationFieldOptions } from "@/components/OrganizationFields";
import type { TonerFormState } from "../../actions";

type Lookup = { id: number; name: string };

type Txn = {
  id: number;
  type: string;
  date: string;
  ticketReference: string | null;
  tonerTypeId: number;
  quantity: number;
  locationId: number | null;
  departmentId: number | null;
  subunitId: number | null;
  costCenterId: number | null;
  itsNameId: number | null;
  remarks: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Changes"}
    </PrimaryButton>
  );
}

export default function EditTransactionForm({
  action,
  txn,
  tonerTypes,
  organizationOptions,
  itsNames,
  showActions = true,
}: {
  action: (prev: TonerFormState, formData: FormData) => Promise<TonerFormState>;
  txn: Txn;
  tonerTypes: Lookup[];
  organizationOptions: OrganizationFieldOptions;
  itsNames: Lookup[];
  showActions?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form id="toner-transaction-edit-form" action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={txn.id} />
      {state.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>
      )}
      <section>
        <FormSectionHeader
          icon={Pencil}
          title="Transaction details"
          description="Update the toner, quantity, assignment, and reference information"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <SearchableDropdown label="Status / Type" name="type" defaultValue={txn.type} required placeholder="Search transaction types..." options={[{ value: "Delivery", label: "Delivery" }, { value: "Request", label: "Request" }]} />
        <Input label="Date" name="date" type="date" defaultValue={txn.date} required />
        <Input label="Ticket or R.Q" name="ticketReference" defaultValue={txn.ticketReference ?? ""} placeholder="Enter ticket or R.Q number" />
        <SearchableSelect
          label="Toner Type"
          name="tonerTypeId"
          options={tonerTypes}
          placeholder="Search toner type..."
          defaultValue={txn.tonerTypeId}
          required
        />
        <Input label="Quantity" name="quantity" type="number" min="1" defaultValue={txn.quantity} required />
        <OrganizationFields
          options={organizationOptions}
          initialLocationId={txn.locationId}
          initialDepartmentId={txn.departmentId}
          initialSubunitId={txn.subunitId}
          initialCostCenterId={txn.costCenterId}
          requiredSubunit
          errors={state.fieldErrors}
          className="contents"
        />
        <SearchableSelect
          label="ITS Name"
          name="itsNameId"
          options={itsNames}
          placeholder="Search ITS Name..."
          defaultValue={txn.itsNameId}
        />
        </div>
      </section>
      <section>
        <FormSectionHeader
          icon={ClipboardList}
          title="Additional notes"
          description="Optional context retained with this transaction"
        />
        <div className="mt-4">
          <Textarea label="Remarks" name="remarks" defaultValue={txn.remarks ?? ""} rows={3} />
        </div>
      </section>
      <div className={showActions ? "flex justify-end border-t border-slate-200 pt-5" : "hidden"}>
        <SubmitButton />
      </div>
    </form>
  );
}

function FormSectionHeader({
  icon,
  title,
  description,
}: {
  icon: IconNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
        <MorphIcon icon={icon} size={17} strokeWidth={2} reducedMotion="user" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-[#014171]">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}
