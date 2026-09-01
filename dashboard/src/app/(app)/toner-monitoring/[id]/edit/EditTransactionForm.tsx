"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input, Select, PrimaryButton, SecondaryButton } from "@/components/ui";
import SearchableSelect from "@/components/SearchableSelect";
import type { TonerFormState } from "../../actions";
import Link from "next/link";

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
  locations,
  departments,
  itsNames,
}: {
  action: (prev: TonerFormState, formData: FormData) => Promise<TonerFormState>;
  txn: Txn;
  tonerTypes: Lookup[];
  locations: Lookup[];
  departments: Lookup[];
  itsNames: Lookup[];
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="id" value={txn.id} />
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Select label="Status / Type" name="type" defaultValue={txn.type} required>
          <option value="Delivery">Delivery</option>
          <option value="Request">Request</option>
        </Select>
        <Input label="Date" name="date" type="date" defaultValue={txn.date} required />
        <Input label="Ticket Reference" name="ticketReference" defaultValue={txn.ticketReference ?? ""} placeholder="Enter ticket or P.O number" />
        <SearchableSelect
          label="Toner Type"
          name="tonerTypeId"
          options={tonerTypes}
          placeholder="Search toner type..."
          defaultValue={txn.tonerTypeId}
          required
        />
        <Input label="Quantity" name="quantity" type="number" min="1" defaultValue={txn.quantity} required />
        <SearchableSelect
          label="Location"
          name="locationId"
          options={locations}
          placeholder="Search location..."
          defaultValue={txn.locationId}
        />
        <SearchableSelect
          label="Department"
          name="departmentId"
          options={departments}
          placeholder="Search department..."
          defaultValue={txn.departmentId}
        />
        <SearchableSelect
          label="ITS Name"
          name="itsNameId"
          options={itsNames}
          placeholder="Search ITS Name..."
          defaultValue={txn.itsNameId}
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</label>
        <textarea name="remarks" defaultValue={txn.remarks ?? ""} rows={3} className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40" />
      </div>
      <div className="flex gap-3">
        <SubmitButton />
        <Link href="/toner-monitoring"><SecondaryButton type="button">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}
