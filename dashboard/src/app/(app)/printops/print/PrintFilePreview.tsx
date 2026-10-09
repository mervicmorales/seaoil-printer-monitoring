"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronDown, Eye, FileText, Printer, TriangleAlert, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import type { PrintOpsPrinterTarget } from "@/lib/printops";
import PrintOpsSubmitButton from "../PrintOpsSubmitButton";
import { printerLabel } from "./print-target-state";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import SearchableDropdown from "@/components/SearchableDropdown";

type PreviewKind = "pdf" | "image" | "text" | "unsupported";
type PrinterOption = PrintOpsPrinterTarget & { agentId?: number };

export default function PrintFilePreview({
  initialTarget,
  selectedAgentId,
  printers,
}: {
  initialTarget: string;
  selectedAgentId: string;
  printers: PrinterOption[];
}) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [textPreview, setTextPreview] = useState("");
  const [target, setTarget] = useState(initialTarget);
  const [open, setOpen] = useState(false);
  const [pageMode, setPageMode] = useState("all");
  const [copies, setCopies] = useState("1");
  const [colorMode, setColorMode] = useState("color");
  const [duplex, setDuplex] = useState("none");
  const [orientation, setOrientation] = useState("portrait");
  const [moreSettings, setMoreSettings] = useState(false);
  const previewUrlRef = useRef("");
  const selectedFileRef = useRef<File | null>(null);
  const previewKind = file ? getPreviewKind(file) : "unsupported";
  useBodyScrollLock(open);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function selectFile(nextFile: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    let nextUrl = "";
    if (nextFile) {
      try {
        nextUrl = URL.createObjectURL(nextFile);
      } catch {
        // Printing can still proceed when a browser cannot create a local preview URL.
      }
    }
    previewUrlRef.current = nextUrl;
    selectedFileRef.current = nextFile;
    setFile(nextFile);
    setPreviewUrl(nextUrl);
    setTextPreview("");
    setOpen(false);
    if (nextFile && getPreviewKind(nextFile) === "text") {
      void nextFile.text().then((value) => {
        if (selectedFileRef.current === nextFile) setTextPreview(value);
      });
    }
  }

  function openPreview(event: MouseEvent<HTMLButtonElement>) {
    const form = event.currentTarget.closest("form");
    const fileInput = form?.querySelector<HTMLInputElement>('input[name="file"]');
    const selectedFile = fileInput?.files?.[0] ?? file;
    if (!selectedFile) {
      fileInput?.reportValidity();
      return;
    }
    if (selectedFile !== file) selectFile(selectedFile);
    setOpen(true);
  }

  return (
    <div className="lg:col-span-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-slate-700">Document</span>
        <input
          type="file"
          name="file"
          required
          accept=".pdf,.txt,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(event) => {
            const nextFile = event.target.files?.[0] ?? null;
            selectFile(nextFile);
          }}
          className="block w-full cursor-pointer rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-1.5 text-sm text-slate-600 shadow-sm transition file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2.5 file:font-semibold file:text-[#014171] file:shadow-sm hover:border-slate-400 hover:bg-slate-50 hover:file:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-[#014171]/15"
        />
      </label>
      <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white text-[#014171] shadow-sm">
            <MorphIcon icon={FileText} size={15} strokeWidth={2} reducedMotion="user" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-700">{file ? file.name : "Choose a document to continue"}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">PDF, TXT, JPG, PNG, DOC, or DOCX · maximum 10 MB</p>
          </div>
        </div>
        <button
          type="button"
          onClick={openPreview}
          className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012f52] hover:shadow-md active:translate-y-px sm:w-auto"
        >
          <MorphIcon icon={Eye} size={15} strokeWidth={2} reducedMotion="user" />
          Preview &amp; Print
        </button>
      </div>

      {open && file && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-preview-title"
            className="mx-auto grid h-full w-full max-w-[1500px] grid-rows-[minmax(12rem,2fr)_minmax(18rem,3fr)] overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-1"
          >
            <div className="flex min-h-0 flex-col bg-slate-200">
              <header className="flex shrink-0 items-center justify-between border-b border-slate-300 bg-white px-4 py-3 text-slate-800 lg:hidden">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-[#014171]"><MorphIcon icon={Eye} size={16} strokeWidth={2} reducedMotion="user" /></span>
                  <h2 className="truncate text-sm font-bold">Document preview</h2>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="Close print preview" className="flex size-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
                  <MorphIcon icon={X} size={17} strokeWidth={2} reducedMotion="user" />
                </button>
              </header>
              <div className={`min-h-0 flex-1 p-4 sm:p-8 ${previewKind === "pdf" ? "overflow-hidden" : "overflow-auto"}`}>
                <div
                  className={`mx-auto flex items-start justify-center ${previewKind === "pdf" ? "h-full min-h-0" : "min-h-full"} ${colorMode === "grayscale" ? "grayscale" : ""}`}
                >
                  {previewKind === "pdf" && previewUrl && (
                    <iframe
                      src={`${previewUrl}#toolbar=0&navpanes=0`}
                      title={`Preview of ${file.name}`}
                      className={`h-full min-h-0 rounded-lg border-0 bg-white shadow-xl ring-1 ring-slate-900/10 ${orientation === "landscape" ? "w-full max-w-5xl" : "w-full max-w-3xl"}`}
                    />
                  )}
                  {previewKind === "image" && previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={`Preview of ${file.name}`}
                      loading="lazy"
                      decoding="async"
                      className={`rounded-lg bg-white object-contain shadow-xl ring-1 ring-slate-900/10 ${orientation === "landscape" ? "aspect-[1.414/1] w-full max-w-5xl" : "aspect-[1/1.414] w-full max-w-3xl"}`}
                    />
                  )}
                  {previewKind === "text" && (
                    <pre className={`min-h-[55rem] whitespace-pre-wrap rounded-lg bg-white p-10 text-sm text-slate-800 shadow-xl ring-1 ring-slate-900/10 ${orientation === "landscape" ? "w-full max-w-5xl" : "w-full max-w-3xl"}`}>
                      {textPreview || "Loading preview…"}
                    </pre>
                  )}
                  {previewKind === "unsupported" && (
                    <div className="mt-20 max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center shadow-sm">
                      <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                        <MorphIcon icon={TriangleAlert} size={18} strokeWidth={2} reducedMotion="user" />
                      </span>
                      <p className="mt-3 font-semibold text-amber-800">Preview unavailable for this file type</p>
                      <p className="mt-2 text-sm text-amber-700">
                        DOC and DOCX can still be sent to the agent, but browsers cannot render them reliably without conversion or uploading.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-slate-200 bg-white text-slate-800">
              <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
                <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                      <MorphIcon icon={Printer} size={18} strokeWidth={2} reducedMotion="user" />
                    </span>
                    <div className="min-w-0">
                      <h2 id="print-preview-title" className="font-bold text-[#014171]">Print settings</h2>
                      <p className="mt-1 max-w-[16rem] truncate text-xs text-slate-500" title={file.name}>{file.name}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => setOpen(false)} aria-label="Close print preview" className="hidden size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 lg:flex">
                    <MorphIcon icon={X} size={17} strokeWidth={2} reducedMotion="user" />
                  </button>
                </header>

                <div className="space-y-5 p-5 sm:p-6">
                  <Setting label="Printer">
                    <SearchableDropdown
                      ariaLabel="Printer"
                      name="target"
                      value={target}
                      onValueChange={setTarget}
                      required
                      disabled={printers.length === 0}
                      placeholder="Search printers..."
                      options={printers.length === 0 ? [{ value: "", label: "No available printers", disabled: true }] : printers.map((printer) => ({ value: `${printer.agentId ?? selectedAgentId}|${printer.printerId}`, label: printerLabel(printer) }))}
                      inputClassName={darkSelectClassName}
                    />
                  </Setting>

                  <Setting label="Pages">
                    <SearchableDropdown ariaLabel="Pages" name="pageMode" value={pageMode} onValueChange={setPageMode} placeholder="Search page modes..." options={[{ value: "all", label: "All" }, { value: "custom", label: "Custom" }]} inputClassName={darkSelectClassName} />
                    {pageMode === "custom" && (
                      <input name="pageRanges" required placeholder="e.g. 1-3, 5" className={`${darkInputClassName} mt-2`} />
                    )}
                  </Setting>

                  <Setting label="Copies">
                    <input aria-label="Copies" name="copies" type="number" min="1" max="99" value={copies} onChange={(event) => setCopies(event.target.value)} required className={darkInputClassName} />
                  </Setting>

                  <Setting label="Color">
                    <SearchableDropdown ariaLabel="Color" name="colorMode" value={colorMode} onValueChange={setColorMode} placeholder="Search color modes..." options={[{ value: "color", label: "Color" }, { value: "grayscale", label: "Grayscale" }]} inputClassName={darkSelectClassName} />
                  </Setting>

                  <Setting label="Duplex">
                    <SearchableDropdown ariaLabel="Duplex" name="duplex" value={duplex} onValueChange={setDuplex} placeholder="Search duplex modes..." options={[{ value: "none", label: "Single-sided" }, { value: "long", label: "Double-sided · long edge" }, { value: "short", label: "Double-sided · short edge" }]} inputClassName={darkSelectClassName} />
                  </Setting>

                  <button
                    type="button"
                    onClick={() => setMoreSettings((value) => !value)}
                    aria-expanded={moreSettings}
                    className="flex w-full items-center justify-between border-t border-slate-200 pt-5 text-left text-sm font-semibold text-[#014171]"
                  >
                    More settings
                    <MorphIcon icon={ChevronDown} size={16} strokeWidth={2} reducedMotion="user" className={`transition ${moreSettings ? "rotate-180" : ""}`} />
                  </button>

                  {!moreSettings && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">Print summary</p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                        <SummaryItem label="Pages" value={pageMode === "all" ? "All pages" : "Custom range"} />
                        <SummaryItem label="Copies" value={copies || "—"} />
                        <SummaryItem label="Color" value={colorMode === "color" ? "Color" : "Grayscale"} />
                        <SummaryItem label="Duplex" value={duplex === "none" ? "Single-sided" : duplex === "long" ? "Long edge" : "Short edge"} />
                      </dl>
                    </div>
                  )}

                  <div className={moreSettings ? "space-y-5" : "hidden"}>
                      <Setting label="Paper size">
                        <SearchableDropdown ariaLabel="Paper size" name="paperSize" defaultValue="a4" placeholder="Search paper sizes..." options={[{ value: "a4", label: "A4" }, { value: "letter", label: "Letter" }, { value: "legal", label: "Legal" }, { value: "a3", label: "A3" }]} inputClassName={darkSelectClassName} />
                      </Setting>
                      <Setting label="Layout">
                        <SearchableDropdown ariaLabel="Layout" name="orientation" value={orientation} onValueChange={setOrientation} placeholder="Search layouts..." options={[{ value: "portrait", label: "Portrait" }, { value: "landscape", label: "Landscape" }]} inputClassName={darkSelectClassName} />
                      </Setting>
                      <Setting label="Pages per sheet">
                        <SearchableDropdown ariaLabel="Pages per sheet" name="pagesPerSheet" defaultValue="1" placeholder="Search page counts..." options={[1, 2, 4, 6, 9, 16].map((value) => ({ value: String(value), label: String(value) }))} inputClassName={darkSelectClassName} />
                      </Setting>
                      <Setting label="Quality">
                        <SearchableDropdown ariaLabel="Quality" name="quality" defaultValue="normal" placeholder="Search quality levels..." options={[{ value: "draft", label: "Draft" }, { value: "normal", label: "Normal" }, { value: "high", label: "High" }]} inputClassName={darkSelectClassName} />
                      </Setting>
                      <Setting label="Scale">
                        <SearchableDropdown ariaLabel="Scale" name="scale" defaultValue="fit" placeholder="Search scale options..." options={[{ value: "fit", label: "Fit to page" }, { value: "100", label: "100%" }, { value: "75", label: "75%" }, { value: "50", label: "50%" }]} inputClassName={darkSelectClassName} />
                      </Setting>
                  </div>
                </div>
              </div>

              <footer className="flex shrink-0 justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
                <button type="button" onClick={() => setOpen(false)} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50">
                  Cancel
                </button>
                <PrintOpsSubmitButton idleLabel="Print" pendingLabel="Sending…" />
              </footer>
            </aside>
          </section>
        </div>
      )}
    </div>
  );
}

function Setting({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-slate-800" title={value}>{value}</dd>
    </div>
  );
}

function getPreviewKind(file: File): PreviewKind {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (file.type === "application/pdf" || extension === "pdf") return "pdf";
  if (file.type.startsWith("image/") || ["jpg", "jpeg", "png"].includes(extension ?? "")) return "image";
  if (file.type.startsWith("text/") || extension === "txt") return "text";
  return "unsupported";
}

const darkInputClassName = "w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15";
const darkSelectClassName = darkInputClassName;
