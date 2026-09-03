"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardList, Droplets, PackagePlus, Send, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, Select, PrimaryButton, SecondaryButton, Textarea } from "@/components/ui";
import type { TonerFormState } from "./actions";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

type Lookup = { id: number; name: string; stock?: number };

function SubmitButton({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending || disabled}>
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
  showActions = true,
}: {
  mode: "delivery" | "request";
  action: (prev: TonerFormState, formData: FormData) => Promise<TonerFormState>;
  tonerTypes: Lookup[];
  locations: Lookup[];
  departments: Lookup[];
  itsNames: Lookup[];
  today: string;
  showActions?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [checked, setChecked] = useState<number[]>([]);
  const [quantity, setQuantity] = useState("");
  const defaultLocationId = locations.find(
    (location) => location.name.trim().toLowerCase() === "taipan head office",
  )?.id;
  const defaultDepartmentId = departments.find(
    (department) => department.name.trim().toLowerCase() === "its",
  )?.id;
  const selectedToners = tonerTypes.filter((toner) => checked.includes(toner.id));
  const allRequestTonersOutOfStock = mode === "request"
    && tonerTypes.length > 0
    && tonerTypes.every((toner) => (toner.stock ?? 0) <= 0);
  const outOfStockToners = mode === "request"
    ? selectedToners.filter((toner) => (toner.stock ?? 0) <= 0)
    : [];
  const requestedQuantity = Number(quantity);
  const insufficientToners = mode === "request" && requestedQuantity > 0
    ? selectedToners.filter((toner) => (toner.stock ?? 0) > 0 && requestedQuantity > (toner.stock ?? 0))
    : [];
  const requestBlocked = allRequestTonersOutOfStock || outOfStockToners.length > 0 || insufficientToners.length > 0;

  function toggle(id: number) {
    setChecked((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  return (
    <form
      id={mode === "delivery" ? "toner-delivery-form" : "toner-request-form"}
      action={formAction}
      className="space-y-6"
    >
      {state.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>
      )}
      <section>
        <FormSectionHeader
          icon={mode === "delivery" ? PackagePlus : Send}
          title={mode === "delivery" ? "Delivery details" : "Request details"}
          description={mode === "delivery" ? "Stock receipt and assignment information" : "Toner issue and destination information"}
        />
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <Input label="Date" name="date" type="date" defaultValue={today} required error={state.fieldErrors?.date} />
        <Input
          label="Ticket Reference"
          name="ticketReference"
          placeholder="Enter ticket or P.O number"
        />
        <Input
          label="Quantity"
          name="quantity"
          type="number"
          min="1"
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          disabled={allRequestTonersOutOfStock || outOfStockToners.length > 0}
          error={state.fieldErrors?.quantity}
        />
        {mode === "request" ? (
          <SearchableSelect label="Location" name="locationId" options={locations} placeholder="Search location..." required error={state.fieldErrors?.locationId} />
        ) : (
          <Select label="Location" name="locationId" defaultValue={defaultLocationId ?? ""}>
            <option value="">Select location</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        )}
        {mode === "request" ? (
          <SearchableSelect label="Department" name="departmentId" options={departments} placeholder="Search department..." required error={state.fieldErrors?.departmentId} />
        ) : (
          <Select label="Department" name="departmentId" defaultValue={defaultDepartmentId ?? ""}>
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        )}
        <SearchableSelect
          label="ITS Name"
          name="itsNameId"
          options={itsNames}
          placeholder="Search ITS Name..."
          required={mode === "request"}
          error={state.fieldErrors?.itsNameId}
        />
        </div>
      </section>

      <section>
        <FormSectionHeader
          icon={Droplets}
          title="Toner types"
          description="Select one or more toner types for this transaction"
        />
        <div className="mt-4 flex flex-wrap gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5">
          {tonerTypes.length === 0 && <p className="text-sm text-slate-400">No toner types configured yet.</p>}
          {tonerTypes.map((t) => (
            <label key={t.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${checked.includes(t.id) ? "border-sky-200 bg-sky-50 text-[#014171]" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`}>
              <input type="checkbox" name="tonerTypeIds" value={t.id} checked={checked.includes(t.id)} onChange={() => toggle(t.id)} />
              <span>{t.name}</span>
              {mode === "request" && (
                <span className={(t.stock ?? 0) <= 0 ? "font-semibold text-red-600" : "text-xs text-slate-500"}>
                  {(t.stock ?? 0) <= 0 ? "Out of stock" : `${t.stock} available`}
                </span>
              )}
            </label>
          ))}
        </div>
        {state.fieldErrors?.tonerTypeIds && <p className="mt-1 text-xs text-red-600">{state.fieldErrors.tonerTypeIds}</p>}
        {allRequestTonersOutOfStock && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            All toner inventory is out of stock. Quantity and Save Request are disabled.
          </p>
        )}
        {!allRequestTonersOutOfStock && outOfStockToners.length > 0 && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {outOfStockToners.map((toner) => toner.name).join(", ")} {outOfStockToners.length === 1 ? "is" : "are"} out of stock. Quantity and Save Request are disabled.
          </p>
        )}
        {insufficientToners.length > 0 && (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            Requested quantity exceeds available stock for {insufficientToners.map((toner) => `${toner.name} (${toner.stock} available)`).join(", ")}.
          </p>
        )}
      </section>

      <section>
        <FormSectionHeader
          icon={ClipboardList}
          title="Additional notes"
          description="Optional context for this toner transaction"
        />
        <div className="mt-4">
          <Textarea label="Remarks" name="remarks" rows={3} />
        </div>
      </section>

      <div className={showActions ? "flex gap-3 border-t border-slate-200 pt-5" : "hidden"}>
        <SubmitButton label={mode === "delivery" ? "Save Delivery" : "Save Request"} disabled={requestBlocked} />
        <Link href="/toner-monitoring"><SecondaryButton type="button">Cancel</SecondaryButton></Link>
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
