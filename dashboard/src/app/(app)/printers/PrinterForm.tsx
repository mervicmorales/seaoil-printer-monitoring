"use client";

import type { ReactNode } from "react";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Activity, Droplets, Printer, RefreshCw, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, PrimaryButton, SecondaryButton } from "@/components/ui";
import SearchableSelect from "@/components/SearchableSelect";
import { formatDate } from "@/lib/format";
import type { PrinterFormState } from "./actions";
import Link from "next/link";

type Lookup = { id: number; name: string };
type ContractLookup = { id: number; contractNumber: string; endDate: string | null };
type MonitoringAgentLookup = { id: number; key: string; name: string };
type EditTab = "details" | "monitoring" | "toner" | "replacement";

const EDIT_TABS: { key: EditTab; label: string; icon: IconNode }[] = [
  { key: "details", label: "Printer Details", icon: Printer },
  { key: "monitoring", label: "Live Monitoring", icon: Activity },
  { key: "toner", label: "Toner Type", icon: Droplets },
  { key: "replacement", label: "Replacement", icon: RefreshCw },
];

type Printer = {
  id: number;
  assetTag: string | null;
  ipAddress: string | null;
  serialNumber: string;
  model: string | null;
  monthlyRate: string | null;
  locationId: number | null;
  departmentId: number | null;
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
  locations,
  departments,
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
  locations: Lookup[];
  departments: Lookup[];
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
  const [activeTab, setActiveTab] = useState<EditTab>("details");

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

      {mode === "edit" && (
        <div
          role="tablist"
          aria-label="Edit printer sections"
          className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5"
        >
          {EDIT_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition sm:flex-1 ${
                activeTab === tab.key
                  ? "bg-white text-[#014171] shadow-[0_2px_8px_rgba(15,23,42,0.08)]"
                  : "text-slate-500 hover:bg-white/60 hover:text-slate-700"
              }`}
            >
              <MorphIcon icon={tab.icon} size={16} strokeWidth={2} reducedMotion="user" />
              {tab.label}
            </button>
          ))}
        </div>
      )}

      <section
        role={mode === "edit" ? "tabpanel" : undefined}
        className={mode === "edit" && activeTab !== "details" ? "hidden" : "block"}
      >
        <FormSectionHeader
          icon={Printer}
          title="Printer details"
          description="Asset identity, assignment, and commercial information"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        <Input
          label="Asset Tag"
          name="assetTag"
          defaultValue={printer?.assetTag ?? ""}
          disabled={mode === "edit" && limitedSupport}
        />
        <Input
          label="IP Address"
          name="ipAddress"
          type="text"
          maxLength={20}
          defaultValue={printer?.ipAddress ?? ""}
          required={monitoringEnabled}
          error={state.fieldErrors?.ipAddress}
        />
        <Input
          label="Serial Number"
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
          name="monthlyRate"
          type="number"
          step="0.01"
          min="0"
          defaultValue={printer?.monthlyRate ?? "0"}
          disabled={mode === "edit" && limitedSupport}
        />
        <SearchableSelect
          label="Location"
          name="locationId"
          options={locations}
          placeholder="Search location..."
          defaultValue={printer?.locationId}
          disabled={mode === "edit" && limitedSupport}
        />
        <SearchableSelect
          label="Department"
          name="departmentId"
          options={departments}
          placeholder="Search department..."
          defaultValue={printer?.departmentId}
          disabled={mode === "edit" && limitedSupport}
        />
        <SearchableSelect
          label="Vendor / Supplier"
          name="vendorId"
          options={vendors}
          placeholder="Search vendor or supplier..."
          defaultValue={printer?.vendorId}
          disabled={mode === "edit" && limitedSupport}
        />
        <SearchableSelect
          label="Contract Number"
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
          readOnly
          disabled
          value={selectedContract?.endDate ? formatDate(selectedContract.endDate) : "—"}
          className="bg-slate-100 text-slate-500"
        />
        <Input
          label="Assigned User"
          name="assignedUser"
          defaultValue={printer?.assignedUser ?? ""}
          placeholder="Employee name"
          disabled={mode === "edit" && limitedSupport}
        />
        </div>
      </section>

      <section
        role={mode === "edit" ? "tabpanel" : undefined}
        className={`${mode === "edit" && activeTab !== "monitoring" ? "hidden" : "block"} overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/45`}
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
              <MorphIcon icon={Activity} size={17} strokeWidth={2} reducedMotion="user" />
            </span>
            <div>
              <p className="text-sm font-bold text-[#014171]">Live monitoring</p>
              <p className="mt-1 text-sm text-slate-500">
                Assign this asset to one authenticated PrintDash agent. Disabling
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

      <section
        role={mode === "edit" ? "tabpanel" : undefined}
        className={mode === "edit" && activeTab !== "toner" ? "hidden" : "block"}
      >
        <FormSectionHeader
          icon={Droplets}
          title="Toner types"
          description="Consumables compatible with this printer"
        />
        <div className="mt-4 flex flex-wrap gap-2.5 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5">
          {tonerTypes.length === 0 && <p className="text-sm text-slate-400">No toner types configured yet.</p>}
          {tonerTypes.map((t) => (
            <label key={t.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${checkedToners.includes(t.id) ? "border-sky-200 bg-sky-50 text-[#014171]" : "border-slate-200 bg-white text-slate-700"}`}>
              <input
                type="checkbox"
                name="tonerTypeIds"
                value={t.id}
                checked={checkedToners.includes(t.id)}
                onChange={() => toggleToner(t.id)}
                disabled={mode === "edit" && limitedSupport}
              />
              {t.name}
            </label>
          ))}
        </div>
      </section>

      <div className={!showActions || (mode === "edit" && activeTab === "replacement") ? "hidden" : "flex gap-3"}>
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
    {mode === "edit" && replacementContent && (
      <div
        role="tabpanel"
        className={activeTab === "replacement" ? "block" : "hidden"}
      >
        {replacementContent}
      </div>
    )}
    </>
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
