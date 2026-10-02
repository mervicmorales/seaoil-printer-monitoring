"use client";

import type { CSSProperties, ReactNode } from "react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Activity, Check, Droplets, Printer, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, PrimaryButton, SecondaryButton } from "@/components/ui";
import SearchableDropdown from "@/components/SearchableDropdown";
import SearchableSelect from "@/components/SearchableSelect";
import OrganizationFields, { type OrganizationFieldOptions } from "@/components/OrganizationFields";
import { formatDate } from "@/lib/format";
import { PRINTER_FLOORS } from "@/lib/printer-floor";
import type { PrinterFormState } from "./actions";
import Link from "next/link";

type Lookup = { id: number; name: string };
type ContractLookup = { id: number; contractNumber: string; endDate: string | null };
type MonitoringAgentLookup = { id: number; key: string; name: string };

const TONER_FACE_SIZE = 42;
const TONER_FACE_GAP = 4;

type Printer = {
  id: number;
  assetTag: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  serialNumber: string;
  model: string | null;
  monthlyRate: string | null;
  floor: string | null;
  locationId: number | null;
  departmentId: number | null;
  subunitId: number | null;
  costCenterId: number | null;
  vendorId: number | null;
  contractId: number | null;
  assignedUser: string | null;
  status: string;
  monitoringEnabled?: boolean;
  monitoringAgentId?: number | null;
};

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </PrimaryButton>
  );
}

export default function PrinterForm({
  mode,
  action,
  printer,
  tonerTypes,
  organizationOptions,
  vendors,
  contracts,
  monitoringAgents,
  selectedTonerTypeIds = [],
  replacementContent,
  returnTo = "/printers",
  limitedSupport = false,
  showActions = true,
}: {
  mode: "create" | "edit";
  action: (prev: PrinterFormState, formData: FormData) => Promise<PrinterFormState>;
  printer?: Printer;
  tonerTypes: Lookup[];
  organizationOptions: OrganizationFieldOptions;
  vendors: Lookup[];
  contracts: ContractLookup[];
  monitoringAgents: MonitoringAgentLookup[];
  selectedTonerTypeIds?: number[];
  replacementContent?: ReactNode;
  returnTo?: string;
  limitedSupport?: boolean;
  showActions?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [contractId, setContractId] = useState<string>(printer?.contractId ? String(printer.contractId) : "");
  const [checkedToners, setCheckedToners] = useState<number[]>(selectedTonerTypeIds);
  const [monitoringEnabled, setMonitoringEnabled] = useState(
    printer?.monitoringEnabled ?? false,
  );
  const floatingLabels = true;

  const selectedContract = contracts.find((c) => String(c.id) === contractId);

  function toggleToner(id: number) {
    setCheckedToners((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  return (
    <>
    <form
      id={mode === "edit" ? "printer-edit-form" : "printer-create-form"}
      action={formAction}
      className="space-y-6"
    >
      {mode === "edit" && printer && <input type="hidden" name="id" value={printer.id} />}
      <input type="hidden" name="returnTo" value={returnTo} />
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}

      <section>
        <FormSectionHeader
          icon={Printer}
          title="Printer details"
          description="Asset identity, assignment, and commercial information"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <Input
          label="Asset Tag"
          floatingLabel={floatingLabels}
          name="assetTag"
          defaultValue={printer?.assetTag ?? ""}
          disabled={mode === "edit" && limitedSupport}
        />
        <Input
          label="IP Address"
          floatingLabel={floatingLabels}
          name="ipAddress"
          type="text"
          maxLength={20}
          defaultValue={printer?.ipAddress ?? ""}
          required={monitoringEnabled}
          error={state.fieldErrors?.ipAddress}
        />
        <Input
          label="MAC Address"
          floatingLabel={floatingLabels}
          name="macAddress"
          placeholder="00:1A:2B:3C:4D:5E"
          maxLength={17}
          defaultValue={printer?.macAddress ?? ""}
          error={state.fieldErrors?.macAddress}
        />
        <Input
          label="Serial Number"
          floatingLabel={floatingLabels}
          name="serialNumber"
          required={mode === "create"}
          defaultValue={printer?.serialNumber ?? ""}
          readOnly={mode === "edit"}
          disabled={mode === "edit"}
          error={state.fieldErrors?.serialNumber}
          className={mode === "edit" ? "bg-slate-100 text-slate-500" : ""}
        />
        <Input
          label="Model"
          floatingLabel={floatingLabels}
          name="model"
          required={mode === "create"}
          defaultValue={printer?.model ?? ""}
          readOnly={mode === "edit"}
          disabled={mode === "edit"}
          error={state.fieldErrors?.model}
          className={mode === "edit" ? "bg-slate-100 text-slate-500" : ""}
        />
        <Input
          label="Monthly Rate (PHP)"
          floatingLabel={floatingLabels}
          name="monthlyRate"
          type="number"
          step="0.01"
          min="0"
          defaultValue={printer?.monthlyRate ?? ""}
          disabled={mode === "edit" && limitedSupport}
        />
        <OrganizationFields
          options={organizationOptions}
          initialLocationId={printer?.locationId}
          initialDepartmentId={printer?.departmentId}
          initialSubunitId={printer?.subunitId}
          initialCostCenterId={printer?.costCenterId}
          requiredSubunit
          floatingLabel={floatingLabels}
          disabled={mode === "edit" && limitedSupport}
          errors={state.fieldErrors}
          className="contents"
        />
        <SearchableDropdown
          label="Location"
          name="floor"
          options={[
            { value: "", label: "No location selected" },
            ...PRINTER_FLOORS.map((floor) => ({ value: floor, label: floor })),
          ]}
          placeholder="Search floor location..."
          defaultValue={printer?.floor ?? ""}
          disabled={mode === "edit" && limitedSupport}
          error={state.fieldErrors?.floor}
          floatingLabel={floatingLabels}
          inputClassName="focus:border-[#040273] focus:ring-[#040273]/15"
        />
        <SearchableSelect
          label="Vendor / Supplier"
          floatingLabel={floatingLabels}
          name="vendorId"
          options={vendors}
          placeholder="Search vendor or supplier..."
          defaultValue={printer?.vendorId}
          disabled={mode === "edit" && limitedSupport}
        />
        <SearchableSelect
          label="Contract Number"
          floatingLabel={floatingLabels}
          name="contractId"
          options={contracts.map((contract) => ({
            id: contract.id,
            name: contract.contractNumber,
          }))}
          placeholder="Search contract number..."
          defaultValue={printer?.contractId}
          onValueChange={(value) => setContractId(value ? String(value) : "")}
          disabled={mode === "edit" && limitedSupport}
        />
        <Input
          label="Warranty / End-of-Contract"
          floatingLabel={floatingLabels}
          readOnly
          disabled
          value={selectedContract?.endDate ? formatDate(selectedContract.endDate) : "—"}
          className="bg-slate-100 text-slate-500"
        />
        <Input
          label="Assigned User"
          floatingLabel={floatingLabels}
          name="assignedUser"
          defaultValue={printer?.assignedUser ?? ""}
          placeholder="Employee name"
          disabled={mode === "edit" && limitedSupport}
        />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50/45">
        <div className="flex flex-col gap-4 rounded-t-2xl border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
              <MorphIcon icon={Activity} size={17} strokeWidth={2} reducedMotion="user" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#014171]">Live monitoring</p>
              <p className="mt-1 text-sm text-slate-500">
                Assign this asset to one authenticated agent. Disabling
                monitoring keeps its existing history.
              </p>
            </div>
          </div>
          <label className="flex shrink-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              name="monitoringEnabled"
              checked={monitoringEnabled}
              onChange={(event) => setMonitoringEnabled(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#014171] focus:ring-[#7DA8D0]"
            />
            Enable monitoring
          </label>
        </div>

        {monitoringEnabled && (
          <div className="max-w-2xl p-4 sm:p-5">
            <SearchableSelect
              label="Monitoring Agent"
              floatingLabel={floatingLabels}
              name="monitoringAgentId"
              options={monitoringAgents.map((agent) => ({
                id: agent.id,
                name: `${agent.name} (${agent.key})`,
              }))}
              placeholder="Search monitoring agent..."
              defaultValue={printer?.monitoringAgentId}
              required
              error={state.fieldErrors?.monitoringAgentId}
            />
            {monitoringAgents.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                No agent with an active credential is available. Create or rotate
                an agent credential first.
              </p>
            )}
          </div>
        )}
      </section>

      <section>
        <FormSectionHeader
          icon={Droplets}
          title="Toner types"
          description="Consumables compatible with this printer"
        />
        <TonerTypePicker
          tonerTypes={tonerTypes}
          checkedToners={checkedToners}
          onToggle={toggleToner}
          disabled={mode === "edit" && limitedSupport}
        />
      </section>

      {mode === "edit" && replacementContent && (
        <section>{replacementContent}</section>
      )}

      <div className={!showActions ? "hidden" : "flex gap-3"}>
        <SubmitButton label={mode === "create" ? "Add Printer" : "Save Changes"} />
        <Link
          href={
            mode === "edit" && printer
              ? `/printers/${printer.id}?returnTo=${encodeURIComponent(returnTo)}`
              : returnTo
          }
        >
          <SecondaryButton type="button">Cancel</SecondaryButton>
        </Link>
      </div>
    </form>
    </>
  );
}

function TonerTypePicker({
  tonerTypes,
  checkedToners,
  onToggle,
  disabled = false,
}: {
  tonerTypes: Lookup[];
  checkedToners: number[];
  onToggle: (id: number) => void;
  disabled?: boolean;
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
          <p className="text-sm font-semibold text-slate-800">Compatible toner selection</p>
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
              <div
                className="pik-rail h-[42px] shrink-0"
                style={{ width: `${railWidth}px` }}
                aria-hidden="true"
              >
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
              <span className="flex size-[42px] shrink-0 items-center justify-center text-lg font-bold tabular-nums text-[#014171]">
                {picked.length}
              </span>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-3 sm:p-5 lg:grid-cols-4">
        {tonerTypes.length === 0 && (
          <p className="col-span-full text-sm text-slate-400">No toner types configured yet.</p>
        )}
        {tonerTypes.map((toner) => {
          const selected = checkedToners.includes(toner.id);
          return (
            <button
              key={toner.id}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onToggle(toner.id)}
              className={`group flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition-all duration-200 focus-visible:ring-2 focus-visible:ring-[#014171]/35 disabled:cursor-not-allowed disabled:opacity-65 ${
                selected
                  ? "border-[#014171]/25 bg-sky-50 text-[#014171] shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold ${tonerFaceColor(toner.name)}`}>
                {tonerFaceLabel(toner.name)}
              </span>
              <span className="min-w-0 flex-1 truncate">{toner.name}</span>
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
