"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Printer, RefreshCw } from "lucide";
import { MorphIcon } from "morphicons/react";
import { gooeyToast } from "goey-toast";
import { Badge, SecondaryButton } from "@/components/ui";
import SearchInput from "@/components/SearchInput";

export type PrinterPermissionState = {
  error?: string;
  success?: string;
  refreshQueuedAt?: number;
  savedPrinterIds?: number[];
};

type PrinterOption = {
  id: number;
  name: string;
  model: string | null;
  serialNumber: string | null;
  ipAddress: string | null;
  department: string | null;
  location: string | null;
  online: boolean;
  status: string;
};

type AgentOption = {
  id: number;
  name: string;
  status: string;
  snapshotAt: string | null;
  printers: PrinterOption[];
};

export default function PrinterPermissionsPanel({
  userId,
  locationName,
  agents,
  permissionIds,
  automaticPrinterIds,
  pendingRequestIds,
  refreshAction,
  saveAction,
}: {
  userId: number;
  locationName: string | null;
  agents: AgentOption[];
  permissionIds: number[];
  automaticPrinterIds: number[];
  pendingRequestIds: number[];
  refreshAction: (
    state: PrinterPermissionState,
    formData: FormData,
  ) => Promise<PrinterPermissionState>;
  saveAction: (
    state: PrinterPermissionState,
    formData: FormData,
  ) => Promise<PrinterPermissionState>;
}) {
  const router = useRouter();
  const [selectedAgentId, setSelectedAgentId] = useState(String(agents[0]?.id ?? ""));
  const [searchQuery, setSearchQuery] = useState("");
  const automaticIds = useMemo(() => new Set(automaticPrinterIds), [automaticPrinterIds]);
  const pendingIds = useMemo(() => new Set(pendingRequestIds), [pendingRequestIds]);
  const [selectedPrinterIds, setSelectedPrinterIds] = useState(
    () => new Set([...permissionIds, ...automaticPrinterIds]),
  );
  const [refreshState, refreshFormAction] = useActionState(refreshAction, {});
  const [saveState, saveFormAction] = useActionState(saveAction, {});
  const selectedAgent = agents.find((agent) => String(agent.id) === selectedAgentId);
  const filteredPrinters = useMemo(() => {
    if (!selectedAgent) return [];
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    if (!normalizedQuery) return selectedAgent.printers;

    return selectedAgent.printers.filter((printer) =>
      [
        printer.name,
        printer.serialNumber,
        printer.model,
        printer.location,
        printer.department,
        printer.ipAddress,
      ].some((value) => value?.toLocaleLowerCase().includes(normalizedQuery)),
    );
  }, [searchQuery, selectedAgent]);
  const selectedCount = useMemo(
    () => selectedAgent?.printers.filter((printer) => selectedPrinterIds.has(printer.id)).length ?? 0,
    [selectedAgent, selectedPrinterIds],
  );

  useEffect(() => {
    if (refreshState.error) {
      gooeyToast.error("Agent refresh could not be queued", {
        id: "printer-permissions-refresh",
        description: refreshState.error,
      });
    } else if (refreshState.success) {
      gooeyToast.success("Agent refresh queued", {
        id: "printer-permissions-refresh",
        description: refreshState.success,
      });
    }

    if (!refreshState.refreshQueuedAt) return;
    const firstRefresh = window.setTimeout(() => router.refresh(), 3_500);
    const secondRefresh = window.setTimeout(() => router.refresh(), 7_000);
    return () => {
      window.clearTimeout(firstRefresh);
      window.clearTimeout(secondRefresh);
    };
  }, [refreshState, router]);

  useEffect(() => {
    if (saveState.error) {
      gooeyToast.error("Printer permissions not updated", {
        id: "printer-permissions-save",
        description: saveState.error,
      });
    } else if (saveState.success) {
      gooeyToast.success("Printer permissions updated", {
        id: "printer-permissions-save",
        description: saveState.success,
      });
      router.refresh();
    }
  }, [saveState, router]);

  if (!locationName) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        Assign a location to this account before configuring printer permissions.
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        No active office agent is assigned to {locationName}.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Available Agent</span>
          <select
            value={selectedAgentId}
            onChange={(event) => {
              setSelectedAgentId(event.target.value);
              setSearchQuery("");
            }}
            className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>{agent.name}</option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-slate-500">
            Agents assigned to {locationName}.
          </span>
        </label>
        <form action={refreshFormAction} className="sm:pt-[1.625rem]">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="agentId" value={selectedAgentId} />
          <RefreshButton />
        </form>
      </div>

      {selectedAgent && (
        <form action={saveFormAction} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="agentId" value={selectedAgent.id} />
          <div className="flex flex-col justify-between gap-2 border-b border-slate-200 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-[#014171]">Available Printers</p>
                <Badge color={selectedAgent.status === "online" ? "green" : "gray"}>{selectedAgent.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {selectedAgent.snapshotAt
                  ? `Agent data refreshed ${formatDateTime(selectedAgent.snapshotAt)}`
                  : "Refresh agent data to retrieve its current printers."}
              </p>
              {automaticPrinterIds.length > 0 && (
                <p className="mt-1 text-xs text-slate-500">
                  Printers in the account&apos;s assigned department are included automatically. Select any additional printers to save permanent access on the profile.
                </p>
              )}
              {pendingRequestIds.length > 0 && (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  {pendingRequestIds.length} printer access request{pendingRequestIds.length === 1 ? " is" : "s are"} awaiting review.
                </p>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-500">
              {selectedCount} selected
            </span>
          </div>

          {selectedAgent.printers.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <MorphIcon icon={Printer} size={20} strokeWidth={2} reducedMotion="user" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-700">No available printers</p>
              <p className="mt-1 text-xs text-slate-500">Refresh the agent to retrieve its latest printer data.</p>
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white p-3 sm:p-4">
                <SearchInput
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  submitOnClear={false}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.preventDefault();
                  }}
                  aria-label="Search available printers"
                  placeholder="Search by serial number, model, floor, department, or IP address"
                />
                {searchQuery && (
                  <p className="mt-2 text-xs text-slate-500">
                    {filteredPrinters.length} of {selectedAgent.printers.length} printers shown
                  </p>
                )}
              </div>

              {filteredPrinters.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                    <MorphIcon icon={Printer} size={20} strokeWidth={2} reducedMotion="user" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-700">No matching printers</p>
                  <p className="mt-1 text-xs text-slate-500">Try another serial number, model, location, department, or IP address.</p>
                </div>
              ) : (
                <div className="grid max-h-80 gap-2 overflow-y-auto p-3 sm:grid-cols-2">
              {filteredPrinters.map((printer) => {
                const automatic = automaticIds.has(printer.id);
                const requested = pendingIds.has(printer.id);
                const checked = automatic || selectedPrinterIds.has(printer.id);
                return (
                  <label
                    key={printer.id}
                    className={`flex items-start gap-3 rounded-xl border p-3.5 transition ${automatic ? "cursor-default" : "cursor-pointer"} ${checked
                      ? "border-sky-300 bg-sky-50/70 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
                  >
                    <input
                      type="checkbox"
                      name="printerId"
                      value={printer.id}
                      checked={checked}
                      disabled={automatic}
                      onChange={(event) => {
                        setSelectedPrinterIds((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(printer.id);
                          else next.delete(printer.id);
                          return next;
                        });
                      }}
                      className="mt-0.5 size-4 rounded border-slate-300 text-[#014171] focus:ring-[#7DA8D0]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2">
                        <span className="truncate text-sm font-semibold text-slate-800">{printer.name}</span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1.5">
                          {automatic && <Badge color="blue">Automatic</Badge>}
                          {requested && <Badge color="yellow">Requested</Badge>}
                          <Badge color={printer.online ? "green" : "gray"}>{printer.online ? printer.status : "Offline"}</Badge>
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {[printer.location, printer.department, printer.model, printer.serialNumber, printer.ipAddress].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                  </label>
                );
              })}
                </div>
              )}
            </>
          )}

          <div className="flex justify-end border-t border-slate-200 bg-slate-50/40 px-4 py-3">
            <SaveButton disabled={selectedAgent.printers.length === 0} />
          </div>
        </form>
      )}
    </div>
  );
}

function RefreshButton() {
  const { pending } = useFormStatus();
  return (
    <SecondaryButton type="submit" disabled={pending} className="h-11 w-full px-4 sm:w-auto">
      <MorphIcon icon={pending ? LoaderCircle : RefreshCw} size={15} strokeWidth={2} reducedMotion="user" className={pending ? "animate-spin" : ""} />
      {pending ? "Queueing…" : "Refresh Agent Data"}
    </SecondaryButton>
  );
}

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012f52] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <MorphIcon icon={pending ? LoaderCircle : Check} size={15} strokeWidth={2} reducedMotion="user" className={pending ? "animate-spin" : ""} />
      {pending ? "Saving…" : "Save Printer Permissions"}
    </button>
  );
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}
