"use client";

import type { CSSProperties } from "react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, ClipboardList, Droplets, PackagePlus, Send, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, PrimaryButton, SecondaryButton, Textarea } from "@/components/ui";
import type { TonerFormState } from "./actions";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import OrganizationFields, { type OrganizationFieldOptions } from "@/components/OrganizationFields";

type Lookup = { id: number; name: string; stock?: number };

const TONER_FACE_SIZE = 42;
const TONER_FACE_GAP = 4;

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
  organizationOptions,
  itsNames,
  today,
  showActions = true,
}: {
  mode: "delivery" | "request";
  action: (prev: TonerFormState, formData: FormData) => Promise<TonerFormState>;
  tonerTypes: Lookup[];
  organizationOptions: OrganizationFieldOptions;
  itsNames: Lookup[];
  today: string;
  showActions?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [checked, setChecked] = useState<number[]>([]);
  const [quantity, setQuantity] = useState("");
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
        <Input label="Date" floatingLabel name="date" type="date" defaultValue={today} required error={state.fieldErrors?.date} />
        <Input
          label="Ticket or R.Q"
          floatingLabel
          name="ticketReference"
          placeholder="Enter ticket or R.Q number"
        />
        <Input
          label="Quantity"
          floatingLabel
          name="quantity"
          type="number"
          min="1"
          required
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
          disabled={allRequestTonersOutOfStock || outOfStockToners.length > 0}
          error={state.fieldErrors?.quantity}
        />
        <OrganizationFields
          options={organizationOptions}
          requiredLocation={mode === "request"}
          requiredDepartment={mode === "request"}
          requiredSubunit={mode === "request"}
          floatingLabel
          errors={state.fieldErrors}
          className="contents"
        />
        <SearchableSelect
          label="ITS Name"
          floatingLabel
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
        <TonerTypePicker
          mode={mode}
          tonerTypes={tonerTypes}
          checkedToners={checked}
          onToggle={toggle}
        />
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

function TonerTypePicker({
  mode,
  tonerTypes,
  checkedToners,
  onToggle,
}: {
  mode: "delivery" | "request";
  tonerTypes: Lookup[];
  checkedToners: number[];
  onToggle: (id: number) => void;
}) {
  const picked = tonerTypes.filter((toner) => checkedToners.includes(toner.id));
  const visiblePicked = picked.slice(0, 4);
  const railWidth = visiblePicked.length > 0
    ? TONER_FACE_SIZE + (visiblePicked.length - 1) * (TONER_FACE_SIZE + TONER_FACE_GAP)
    : 0;

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/40">
      {checkedToners.map((tonerId) => (
        <input key={tonerId} type="hidden" name="tonerTypeIds" value={tonerId} />
      ))}
      <div className="flex min-h-[68px] flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <p className="text-sm font-semibold text-slate-800">Toner selection</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {picked.length === 0 ? "Select one or more toner types" : `${picked.length} toner type${picked.length === 1 ? "" : "s"} selected`}
          </p>
        </div>
        <div
          className="flex h-[52px] w-fit shrink-0 items-center gap-4 overflow-hidden rounded-full border border-slate-200 bg-slate-50 px-3"
          aria-label={picked.length === 0 ? "No toner types selected" : `Selected toner types: ${picked.map((toner) => toner.name).join(", ")}`}
        >
          {picked.length === 0 ? (
            <span className="text-xs font-medium text-slate-400">None selected</span>
          ) : (
            <>
              <div className="pik-rail h-[42px] shrink-0" style={{ width: `${railWidth}px` }} aria-hidden="true">
                {visiblePicked.map((toner, index) => (
                  <span
                    key={toner.id}
                    title={toner.name}
                    className={`pik-face ${tonerFaceColor(toner.name)}`}
                    style={{ "--pik-x": `${index * (TONER_FACE_SIZE + TONER_FACE_GAP)}px` } as CSSProperties}
                  >
                    {tonerFaceLabel(toner.name)}
                  </span>
                ))}
              </div>
              <span className="flex size-[42px] shrink-0 items-center justify-center text-lg font-bold tabular-nums text-[#014171]">{picked.length}</span>
            </>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {tonerTypes.length === 0 && <p className="text-sm text-slate-400">No toner types configured yet.</p>}
        {tonerTypes.map((toner) => {
          const selected = checkedToners.includes(toner.id);
          const unavailable = mode === "request" && (toner.stock ?? 0) <= 0;
          return (
            <button
              key={toner.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onToggle(toner.id)}
              className={`group flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#014171]/35 ${
                selected ? "border-[#014171]/25 bg-sky-50 text-[#014171] shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${tonerFaceColor(toner.name)}`}>{tonerFaceLabel(toner.name)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{toner.name}</span>
                {mode === "request" && (
                  <span className={`block text-[10px] ${unavailable ? "font-semibold text-red-600" : "text-slate-500"}`}>
                    {unavailable ? "Out of stock" : `${toner.stock} available`}
                  </span>
                )}
              </span>
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-full transition ${selected ? "bg-[#014171] text-white" : "bg-slate-100 text-transparent group-hover:text-slate-300"}`}>
                <MorphIcon icon={Check} size={12} strokeWidth={2.5} reducedMotion="user" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function tonerFaceLabel(name: string) {
  const normalized = name.trim();
  if (/^CF/i.test(normalized)) return "CF";
  const colorSuffix = normalized.match(/(?:^|\s)([BCMY])$/i)?.[1];
  if (colorSuffix) return colorSuffix.toUpperCase();
  if (/ribbon/i.test(normalized)) return "R";
  return normalized.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "T";
}

function tonerFaceColor(name: string) {
  if (/(?:^|\s)C$/i.test(name)) return "bg-cyan-500 text-white";
  if (/(?:^|\s)M$/i.test(name)) return "bg-fuchsia-500 text-white";
  if (/(?:^|\s)Y$/i.test(name)) return "bg-yellow-300 text-slate-900";
  if (/(?:^|\s)B$/i.test(name)) return "bg-slate-800 text-white";
  if (/ribbon/i.test(name)) return "bg-violet-500 text-white";
  return "bg-[#014171] text-white";
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
