"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  LoaderCircle,
  ShieldCheck,
  X,
} from "lucide";
import { IconGlyph } from "@/components/ui";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import SearchableDropdown from "@/components/SearchableDropdown";
import type {
  TonerExpenseExportFormat,
  TonerExpenseExportPreview,
} from "@/lib/toner-expense-export";

type LookupOption = { id: number; name: string };
type SubunitLookupOption = LookupOption & { departmentId: number };
type FilterState = {
  allTime: boolean;
  dateFrom: string;
  dateTo: string;
  department: string;
  subunit: string;
  costCenter: string;
  location: string;
  tonerType: string;
  itsName: string;
};

export default function TonerExpenseExportDialog({
  initialFilters,
  initialPreview,
  departments,
  subunits,
  costCenters,
  locations,
  tonerTypes,
  itsNames,
}: {
  initialFilters: FilterState;
  initialPreview: TonerExpenseExportPreview;
  departments: LookupOption[];
  subunits: SubunitLookupOption[];
  costCenters: LookupOption[];
  locations: LookupOption[];
  tonerTypes: LookupOption[];
  itsNames: LookupOption[];
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [filters, setFilters] = useState(initialFilters);
  const [format, setFormat] = useState<TonerExpenseExportFormat>("xlsx");
  const [preview, setPreview] = useState(initialPreview);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const query = useMemo(() => buildQuery(filters), [filters]);
  const availableSubunits = useMemo(() => (
    filters.department && filters.department !== "unassigned"
      ? subunits.filter((item) => String(item.departmentId) === filters.department)
      : subunits
  ), [filters.department, subunits]);
  useBodyScrollLock(open);

  const closeDialog = useCallback((force = false) => {
    if (exporting && !force) return;
    setVisible(false);
    setError("");
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      triggerRef.current?.focus();
    }, 280);
  }, [exporting]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!open) return;
    const focusFrame = window.requestAnimationFrame(() => {
      setVisible(true);
      closeRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !exporting) {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, exporting, open]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setPreviewLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/toner-expenses/export?format=preview&${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json() as {
          success: boolean;
          preview?: TonerExpenseExportPreview;
          message?: string;
        };
        if (!response.ok || !payload.success || !payload.preview) {
          throw new Error(payload.message || "Preview could not be loaded.");
        }
        setPreview(payload.preview);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Preview could not be loaded.");
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  function updateFilter<Key extends keyof FilterState>(key: Key, value: FilterState[Key]) {
    setFilters((current) => {
      const next = { ...current, [key]: value };
      if (key === "department" && current.department !== value) next.subunit = "";
      return next;
    });
  }

  async function exportReport() {
    setExporting(true);
    setError("");
    try {
      const response = await fetch(`/api/toner-expenses/export?format=${format}&${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        throw new Error(payload?.message || "The export could not be generated.");
      }
      const blob = await response.blob();
      const contentDisposition = response.headers.get("Content-Disposition") ?? "";
      const fileName = contentDisposition.match(/filename="([^"]+)"/)?.[1]
        ?? `toner-expenses.${format}`;
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
      closeDialog(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The export could not be generated.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setFilters(initialFilters);
          setPreview(initialPreview);
          setFormat("xlsx");
          setError("");
          setVisible(false);
          setOpen(true);
        }}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2"
      >
        <IconGlyph icon={Download} size={16} />
        Export data
      </button>

      {open && createPortal(
        <div
          className={`fixed inset-0 z-[120] flex items-stretch justify-end bg-[#014171]/70 p-0 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-0"}`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="toner-export-title"
            aria-describedby="toner-export-description"
            className={`flex h-dvh w-full max-w-4xl flex-col overflow-hidden border-l border-white/20 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.32)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:m-3 sm:h-[calc(100dvh-1.5rem)] sm:rounded-3xl sm:border sm:border-slate-200 ${visible ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex h-[55px] shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
                <span className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[11px]">Toner Expenses</span>
                <span className="text-slate-400" aria-hidden="true">›</span>
                <h2 id="toner-export-title" className="truncate text-sm font-medium tracking-[-0.01em] text-slate-800 sm:text-[15px]">Export Data</h2>
                <p id="toner-export-description" className="sr-only">Choose the export scope and file type, then review the live totals before downloading.</p>
              </div>
              <button
                ref={closeRef}
                type="button"
                onClick={() => closeDialog()}
                disabled={exporting}
                aria-label="Close export dialog"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <IconGlyph icon={X} size={17} />
              </button>
            </div>

            <div className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(17rem,0.8fr)]">
                <div className="space-y-5">
                  <section aria-labelledby="export-scope-heading">
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm"><IconGlyph icon={Info} size={15} /></span>
                        <h3 id="export-scope-heading" className="text-sm font-semibold text-slate-900">Export scope</h3>
                      </div>
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-slate-600">
                        <input
                          type="checkbox"
                          checked={filters.allTime}
                          onChange={(event) => {
                            const allTime = event.target.checked;
                            setFilters((current) => {
                              if (allTime || (current.dateFrom && current.dateTo)) {
                                return { ...current, allTime };
                              }
                              const today = manilaDate();
                              return {
                                ...current,
                                allTime: false,
                                dateFrom: `${today.slice(0, 4)}-01-01`,
                                dateTo: today,
                              };
                            });
                          }}
                          className="size-4 rounded border-slate-300 text-[#014171] focus:ring-[#014171]"
                        />
                        All recorded requests
                      </label>
                    </div>
                    <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
                      <Field label="Date from">
                        <input
                          type="date"
                          value={filters.dateFrom}
                          disabled={filters.allTime}
                          onChange={(event) => updateFilter("dateFrom", event.target.value)}
                          className={fieldClassName}
                        />
                      </Field>
                      <Field label="Date to">
                        <input
                          type="date"
                          value={filters.dateTo}
                          disabled={filters.allTime}
                          onChange={(event) => updateFilter("dateTo", event.target.value)}
                          className={fieldClassName}
                        />
                      </Field>
                      <FilterField label="Department" value={filters.department} onChange={(value) => updateFilter("department", value)} options={departments} includeUnassigned />
                      <FilterField label="Subunit" value={filters.subunit} onChange={(value) => updateFilter("subunit", value)} options={availableSubunits} includeUnassigned />
                      <FilterField label="Cost center" value={filters.costCenter} onChange={(value) => updateFilter("costCenter", value)} options={costCenters} includeUnassigned />
                      <FilterField label="Office" value={filters.location} onChange={(value) => updateFilter("location", value)} options={locations} includeUnassigned />
                      <FilterField label="Toner type" value={filters.tonerType} onChange={(value) => updateFilter("tonerType", value)} options={tonerTypes} />
                      <FilterField label="ITS name" value={filters.itsName} onChange={(value) => updateFilter("itsName", value)} options={itsNames} includeUnassigned />
                    </div>
                  </section>

                  <section aria-labelledby="file-type-heading">
                    <div className="flex items-center gap-2.5 rounded-lg bg-slate-100 px-3.5 py-2.5">
                      <span className="flex size-7 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm"><IconGlyph icon={FileSpreadsheet} size={15} /></span>
                      <h3 id="file-type-heading" className="text-sm font-semibold text-slate-900">File type</h3>
                    </div>
                    <div className="grid gap-3 px-3 py-3 sm:grid-cols-2">
                      <FormatOption
                        active={format === "xlsx"}
                        icon={FileSpreadsheet}
                        title="Excel workbook (.xlsx)"
                        description="Editable details plus summary, department, office, and export-information sheets."
                        onClick={() => setFormat("xlsx")}
                      />
                      <FormatOption
                        active={format === "csv"}
                        icon={FileText}
                        title="CSV data (.csv)"
                        description="A simple row-level data file for analysis or import into another system."
                        onClick={() => setFormat("csv")}
                      />
                    </div>
                  </section>
                </div>

                <aside className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-100 px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-7 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm"><IconGlyph icon={FileText} size={15} /></span>
                        <h3 className="text-sm font-semibold text-slate-900">Live export preview</h3>
                      </div>
                      {previewLoading && <IconGlyph icon={LoaderCircle} size={16} />}
                    </div>
                    <div className={`px-3 py-3 transition-opacity ${previewLoading ? "opacity-55" : "opacity-100"}`}>
                      <PreviewMetric label="Request records" value={numberFormatter.format(preview.recordCount)} />
                      <PreviewMetric label="Units" value={numberFormatter.format(preview.totalUnits)} />
                      <PreviewMetric label="Estimated expense" value={currencyFormatter.format(preview.totalExpenseCents / 100)} />
                      <PreviewMetric label="Price coverage" value={`${preview.priceCoverage}%`} />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0"><IconGlyph icon={Info} size={16} /></span>
                      <p className="text-xs leading-5">Historical expense estimates use each toner type&apos;s current unit cost. Changing a unit cost changes the estimate, not the original request record.</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-[#014171]">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 shrink-0"><IconGlyph icon={ShieldCheck} size={16} /></span>
                      <p className="text-xs leading-5">Exports require Toner Expenses access, are limited to 50,000 records, and every completed download is recorded in the audit log.</p>
                    </div>
                  </div>
                </aside>
              </div>

              {error && (
                <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-[11px] leading-4 text-slate-500">For internal SEAOIL use only.</p>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={exportReport}
                  disabled={exporting || previewLoading || preview.recordCount === 0 || Boolean(error)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#012c50] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <IconGlyph icon={exporting ? LoaderCircle : Download} size={16} />
                  {exporting ? "Preparing export…" : `Download ${format.toUpperCase()}`}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

const fieldClassName = "h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400";
const currencyFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });
const numberFormatter = new Intl.NumberFormat("en-PH");

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function FilterField({
  label,
  value,
  onChange,
  options,
  includeUnassigned = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: LookupOption[];
  includeUnassigned?: boolean;
}) {
  return <SearchableDropdown label={label} value={value} onValueChange={onChange} placeholder={`Search ${label.toLowerCase()}...`} options={[{ value: "", label: `All ${label.toLowerCase()}s` }, ...(includeUnassigned ? [{ value: "unassigned", label: "Unassigned" }] : []), ...options.map((option) => ({ value: String(option.id), label: option.name }))]} inputClassName={fieldClassName} labelClassName="!text-[10px] !font-bold !uppercase !tracking-[0.06em] !text-slate-500" />;
}

function FormatOption({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: typeof FileSpreadsheet;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] ${active ? "border-[#014171] bg-sky-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${active ? "bg-[#014171] text-white" : "bg-slate-100 text-slate-500"}`}>
        <IconGlyph icon={icon} size={17} />
      </span>
      <span>
        <span className="block text-xs font-bold text-slate-800">{title}</span>
        <span className="mt-1 block text-[11px] leading-4 text-slate-500">{description}</span>
      </span>
    </button>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3 py-2">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

function buildQuery(filters: FilterState) {
  const params = new URLSearchParams();
  if (filters.allTime) params.set("allTime", "1");
  else {
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
  }
  if (filters.department) params.set("department", filters.department);
  if (filters.subunit) params.set("subunit", filters.subunit);
  if (filters.costCenter) params.set("costCenter", filters.costCenter);
  if (filters.location) params.set("location", filters.location);
  if (filters.tonerType) params.set("tonerType", filters.tonerType);
  if (filters.itsName) params.set("itsName", filters.itsName);
  return params.toString();
}

function manilaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).format(new Date());
}
