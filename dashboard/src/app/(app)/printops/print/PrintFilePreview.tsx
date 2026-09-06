"use client";

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { ChevronDown, Eye, FileText, Printer, TriangleAlert, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import type { PrintOpsPrinterTarget } from "@/lib/printops";
import PrintOpsSubmitButton from "../PrintOpsSubmitButton";
import { printerLabel } from "./print-target-state";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

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
  const [colorMode, setColorMode] = useState("color");
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
                    <select
                      name="target"
                      value={target}
                      onChange={(event) => setTarget(event.target.value)}
                      required
                      disabled={printers.length === 0}
                      className={darkSelectClassName}
                    >
                      {printers.length === 0 && <option value="">No available printers</option>}
                      {printers.map((printer) => (
                        <option
                          key={`${printer.agentId ?? selectedAgentId}-${printer.printerId}`}
                          value={`${printer.agentId ?? selectedAgentId}|${printer.printerId}`}
                        >
                          {printerLabel(printer)}
                        </option>
                      ))}
                    </select>
                  </Setting>

                  <Setting label="Pages">
                    <select name="pageMode" value={pageMode} onChange={(event) => setPageMode(event.target.value)} className={darkSelectClassName}>
                      <option value="all">All</option>
                      <option value="custom">Custom</option>
                    </select>
                    {pageMode === "custom" && (
                      <input name="pageRanges" required placeholder="e.g. 1-3, 5" className={`${darkInputClassName} mt-2`} />
                    )}
                  </Setting>

                  <Setting label="Copies">
                    <input name="copies" type="number" min="1" max="99" defaultValue="1" required className={darkInputClassName} />
                  </Setting>

                  <Setting label="Color">
                    <select name="colorMode" value={colorMode} onChange={(event) => setColorMode(event.target.value)} className={darkSelectClassName}>
                      <option value="color">Color</option>
                      <option value="grayscale">Grayscale</option>
                    </select>
                  </Setting>

                  <Setting label="Duplex">
                    <select name="duplex" defaultValue="none" className={darkSelectClassName}>
                      <option value="none">Single-sided</option>
                      <option value="long">Double-sided · long edge</option>
                      <option value="short">Double-sided · short edge</option>
                    </select>
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

                  <div className={moreSettings ? "space-y-5" : "hidden"}>
                      <Setting label="Paper size">
                        <select name="paperSize" defaultValue="a4" className={darkSelectClassName}>
                          <option value="a4">A4</option>
                          <option value="letter">Letter</option>
                          <option value="legal">Legal</option>
                          <option value="a3">A3</option>
                        </select>
                      </Setting>
                      <Setting label="Layout">
                        <select name="orientation" value={orientation} onChange={(event) => setOrientation(event.target.value)} className={darkSelectClassName}>
                          <option value="portrait">Portrait</option>
                          <option value="landscape">Landscape</option>
                        </select>
                      </Setting>
                      <Setting label="Pages per sheet">
                        <select name="pagesPerSheet" defaultValue="1" className={darkSelectClassName}>
                          {[1, 2, 4, 6, 9, 16].map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </Setting>
                      <Setting label="Quality">
                        <select name="quality" defaultValue="normal" className={darkSelectClassName}>
                          <option value="draft">Draft</option>
                          <option value="normal">Normal</option>
                          <option value="high">High</option>
                        </select>
                      </Setting>
                      <Setting label="Scale">
                        <select name="scale" defaultValue="fit" className={darkSelectClassName}>
                          <option value="fit">Fit to page</option>
                          <option value="100">100%</option>
                          <option value="75">75%</option>
                          <option value="50">50%</option>
                        </select>
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
    <label className="grid min-w-0 gap-2 text-sm sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
      <span className="font-semibold text-slate-600">{label}</span>
      <span className="min-w-0">{children}</span>
    </label>
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
const darkSelectClassName = `${darkInputClassName} appearance-auto`;
