"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input, Select, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { TonerFormState } from "./actions";
import Link from "next/link";

type Lookup = { id: number; name: string };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </PrimaryButton>
  );
}

export default function TonerDeliveryRequestForm({
  mode,
  action,
  tonerTypes,
  locations,
  departments,
  itsNames,
  today,
}: {
  mode: "delivery" | "request";
  action: (prev: TonerFormState, formData: FormData) => Promise<TonerFormState>;
  tonerTypes: Lookup[];
  locations: Lookup[];
  departments: Lookup[];
  itsNames: Lookup[];
  today: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [checked, setChecked] = useState<number[]>([]);

  function toggle(id: number) {
    setChecked((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Date" name="date" type="date" defaultValue={today} required error={state.fieldErrors?.date} />
        <Input
          label="Ticket Reference"
          name="ticketReference"
          placeholder="Enter ticket or P.O number"
        />
        <Input label="Quantity" name="quantity" type="number" min="1" required error={state.fieldErrors?.quantity} />
        <Select label="Location" name="locationId">
          <option value="">Select location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        <Select label="Department" name="departmentId">
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select label="ITS Name" name="itsNameId">
          <option value="">Select ITS Name</option>
          {itsNames.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </Select>
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Toner Type(s) <span className="text-red-500">*</span></p>
        <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-4">
          {tonerTypes.length === 0 && <p className="text-sm text-slate-400">No toner types configured yet.</p>}
          {tonerTypes.map((t) => (
            <label key={t.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm">
              <input type="checkbox" name="tonerTypeIds" value={t.id} checked={checked.includes(t.id)} onChange={() => toggle(t.id)} />
              {t.name}
            </label>
          ))}
        </div>
        {state.fieldErrors?.tonerTypeIds && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.tonerTypeIds}</p>}
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Remarks</label>
        <textarea name="remarks" rows={3} className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40" />
      </div>

      <div className="flex gap-3">
        <SubmitButton label={mode === "delivery" ? "Save Delivery" : "Save Request"} />
        <Link href="/toner-monitoring"><SecondaryButton type="button">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}
