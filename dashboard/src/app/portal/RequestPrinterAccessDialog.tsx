"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Check, LoaderCircle, MapPin, Printer, Search, Send, Wifi, X, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { gooeyToast } from "goey-toast";
import { Badge, IconGlyph } from "@/components/ui";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import type {
  EmployeePrinterRequestOption,
  EmployeePrinterRequestScope,
} from "@/lib/employee-printer-requests";
import { buildPrinterAccessRequestCompose } from "@/lib/email-templates";
import { requestPrinterAccessAction } from "./actions";

export default function RequestPrinterAccessDialog({
  scope,
  employee,
}: {
  scope: EmployeePrinterRequestScope;
  employee: { id: number; name: string; email: string };
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [requestingId, setRequestingId] = useState<number | null>(null);
  const [newlyRequestedIds, setNewlyRequestedIds] = useState<Set<number>>(() => new Set());
  const [, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);

  const requestedIds = useMemo(() => new Set([
    ...scope.printers
      .filter((printer) => printer.requestStatus === "pending")
      .map((printer) => printer.id),
    ...newlyRequestedIds,
  ]), [newlyRequestedIds, scope.printers]);
  const filteredPrinters = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return scope.printers;
    return scope.printers.filter((printer) => [
      printer.serialNumber,
      printer.model,
      printer.locationName,
      printer.departmentName,
      printer.ipAddress,
    ].some((value) => value?.toLowerCase().includes(normalized)));
  }, [query, scope.printers]);

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => closeRef.current?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function closeDialog() {
    setOpen(false);
    setQuery("");
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function requestAccess(printer: EmployeePrinterRequestOption) {
    const gmailUrl = buildGmailComposeUrl(printer, employee);
    if (requestedIds.has(printer.id)) {
      if (!openGmailWindow(gmailUrl)) showPopupBlockedToast(printer.id);
      return;
    }

    const gmailWindow = openGmailWindow("about:blank");
    setRequestingId(printer.id);
    startTransition(async () => {
      try {
        const result = await requestPrinterAccessAction(printer.id);
        if (result.error) {
          gmailWindow?.close();
          gooeyToast.error("Request could not be saved", {
            id: `printer-access-request-${printer.id}`,
            description: result.error,
          });
          return;
        }
        setNewlyRequestedIds((current) => new Set(current).add(printer.id));
        if (gmailWindow) {
          gmailWindow.location.href = gmailUrl;
        } else if (!openGmailWindow(gmailUrl)) {
          showPopupBlockedToast(printer.id);
          return;
        }
        gooeyToast.success("Gmail compose opened", {
          id: `printer-access-request-${printer.id}`,
          description: "Review the prepared request and click Send in Gmail.",
        });
      } finally {
        setRequestingId(null);
      }
    });
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md active:translate-y-px"
      >
        <IconGlyph icon={Wifi} size={16} />
        Request Printer Access
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-[2px] sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="request-printer-access-title"
            className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f7fa] shadow-[0_28px_80px_rgba(15,23,42,0.28)] sm:max-h-[calc(100dvh-3rem)]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                  <MorphIcon icon={Printer} size={20} strokeWidth={2} reducedMotion="user" />
                </span>
                <div className="min-w-0">
                  <h2 id="request-printer-access-title" className="text-lg font-bold tracking-[-0.02em] text-[#014171]">
                    Request Printer Access
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Select a printer managed by the office agent available on your network.
                  </p>
                </div>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={closeDialog}
                aria-label="Close printer access request"
                className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
              >
                <MorphIcon icon={X} size={17} strokeWidth={2} reducedMotion="user" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-3 rounded-xl border border-sky-100 bg-sky-50/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-sky-700"><IconGlyph icon={Wifi} size={18} /></span>
                  <div>
                    <p className="text-sm font-bold text-[#014171]">
                      {scope.mode === "office-network" ? "Office Wi-Fi detected" : "Assigned office agent"}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-600">
                      {scope.agentNames.length > 0
                        ? scope.agentNames.join(", ")
                        : "No online monitoring agent is currently available."}
                      {scope.mode === "assigned-location" && scope.agentNames.length > 0
                        ? " · Network address hidden by the connection; using your assigned location."
                        : ""}
                    </p>
                  </div>
                </div>
                <Badge color={scope.printers.length > 0 ? "blue" : "gray"}>
                  {scope.printers.length} printer{scope.printers.length === 1 ? "" : "s"}
                </Badge>
              </div>

              {scope.printers.length > 0 && (
                <label className="relative mb-4 block">
                  <span className="sr-only">Search printers</span>
                  <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
                    <IconGlyph icon={Search} size={16} />
                  </span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by serial number, model, floor, department, or IP address"
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15"
                  />
                </label>
              )}

              {filteredPrinters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <MorphIcon icon={Printer} size={21} strokeWidth={2} reducedMotion="user" />
                  </span>
                  <p className="mt-3 text-sm font-bold text-slate-700">
                    {scope.printers.length === 0 ? "No network printers available" : "No matching printers"}
                  </p>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-slate-500">
                    {scope.printers.length === 0
                      ? "Connect to the office network and make sure the monitoring agent is online, then reopen this window."
                      : "Try another serial number, model, floor, department, or IP address."}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {filteredPrinters.map((printer) => {
                    const requested = requestedIds.has(printer.id);
                    const requesting = requestingId === printer.id;
                    return (
                      <article key={printer.id} className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Serial Number</p>
                            <h3 className="mt-1 truncate font-mono text-sm font-bold text-slate-800">{printer.serialNumber}</h3>
                            <p className="mt-1 truncate text-xs text-slate-500">{printer.model || "Model unavailable"}</p>
                          </div>
                          {printer.alreadyAccessible
                            ? <Badge color="green">Available</Badge>
                            : requested
                              ? <Badge color="yellow">Pending</Badge>
                              : <Badge color="blue">Requestable</Badge>}
                        </div>
                        <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs">
                          <RequestDetail icon={MapPin} label="Location" value={printer.locationName} />
                          <RequestDetail icon={Printer} label="Department" value={printer.departmentName} />
                          <RequestDetail icon={Wifi} label="IP Address" value={printer.ipAddress} mono />
                          <RequestDetail icon={Wifi} label="Agent" value={printer.agentName} />
                        </dl>
                        <button
                          type="button"
                          disabled={printer.alreadyAccessible || requestingId !== null}
                          onClick={() => requestAccess(printer)}
                          className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-[#014171] transition hover:border-sky-300 hover:bg-sky-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500"
                        >
                          {requesting
                            ? <><MorphIcon icon={LoaderCircle} size={15} className="animate-spin" reducedMotion="user" /> Sending request…</>
                            : printer.alreadyAccessible
                              ? <><IconGlyph icon={Check} size={15} /> Already available</>
                              : requested
                                ? <><IconGlyph icon={Send} size={15} /> Open Gmail compose</>
                                : <><IconGlyph icon={Send} size={15} /> Request access</>}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </>
  );
}

function openGmailWindow(url: string) {
  const openedWindow = window.open(url, "_blank");
  if (openedWindow) openedWindow.opener = null;
  return openedWindow;
}

function showPopupBlockedToast(printerId: number) {
  gooeyToast.warning("Gmail pop-up blocked", {
    id: `printer-access-popup-${printerId}`,
    description: "Allow pop-ups for this site, then use Open Gmail compose again.",
  });
}

function buildGmailComposeUrl(
  printer: EmployeePrinterRequestOption,
  employee: { id: number; name: string; email: string },
) {
  const requestedAt = new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date());
  const reviewUrl = `${window.location.origin}/manage/${employee.id}`;
  const template = buildPrinterAccessRequestCompose({
    employeeName: employee.name,
    employeeEmail: employee.email,
    printerSerialNumber: printer.serialNumber,
    printerModel: printer.model,
    location: printer.locationName,
    department: printer.departmentName,
    ipAddress: printer.ipAddress,
    agentName: printer.agentName,
    requestedAt,
    reviewUrl,
  });
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: "itservicedesk@seaoil.com.ph",
    su: template.subject,
    body: template.body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

function RequestDetail({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: IconNode;
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 font-semibold text-slate-400">
        <IconGlyph icon={icon} size={12} /> {label}
      </dt>
      <dd className={`mt-1 truncate font-medium text-slate-700 ${mono ? "font-mono" : ""}`}>{value || "—"}</dd>
    </div>
  );
}
