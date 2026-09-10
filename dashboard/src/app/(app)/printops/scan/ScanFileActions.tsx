"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, Eye, FileCheck2, X } from "lucide";
import { IconGlyph } from "@/components/ui";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

type ScanFile = {
  id: number;
  name: string;
  mimeType: string | null;
};

type SaveFilePicker = (options: {
  suggestedName: string;
  types: Array<{ description: string; accept: Record<string, string[]> }>;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

export default function ScanFileActions({
  scan,
  fullWidth = false,
}: {
  scan: ScanFile;
  fullWidth?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className={`inline-flex gap-2 ${fullWidth ? "w-full" : ""}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-[#014171] shadow-sm transition hover:border-sky-200 hover:bg-sky-50 ${fullWidth ? "flex-1" : ""}`}
        >
          <IconGlyph icon={Eye} size={14} />
          Preview
        </button>
        <SaveAsButton scan={scan} fullWidth={fullWidth} />
      </div>
      <ScanPreviewDialog scan={scan} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function LatestScanAutoPreview({ scan }: { scan: ScanFile | null }) {
  const [dismissedScanId, setDismissedScanId] = useState<number | null>(null);

  if (!scan) return null;
  return (
    <ScanPreviewDialog
      scan={scan}
      open={dismissedScanId !== scan.id}
      onClose={() => setDismissedScanId(scan.id)}
    />
  );
}

function ScanPreviewDialog({
  scan,
  open,
  onClose,
}: {
  scan: ScanFile;
  open: boolean;
  onClose: () => void;
}) {
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const previewUrl = `/api/printops/scans/${scan.id}?view=1`;
  const isImage = scan.mimeType?.startsWith("image/") ?? false;
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!mounted || !open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`scan-preview-title-${scan.id}`}
        className="flex h-full max-h-[900px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-white shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <IconGlyph icon={FileCheck2} size={17} />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">Scan complete</p>
              <h2 id={`scan-preview-title-${scan.id}`} className="truncate text-sm font-bold text-slate-800 sm:text-base">{scan.name}</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close scan preview" className="flex size-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
            <IconGlyph icon={X} size={18} />
          </button>
        </header>

        <div className="min-h-0 flex-1 bg-slate-200 p-2 sm:p-5">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={`Preview of ${scan.name}`} className="mx-auto h-full max-w-full rounded-lg bg-white object-contain shadow-lg" />
          ) : (
            <iframe src={`${previewUrl}#toolbar=1&navpanes=0`} title={`Preview of ${scan.name}`} className="h-full w-full rounded-lg border-0 bg-white shadow-lg" />
          )}
        </div>

        <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs leading-5 text-slate-500">Review the document, then save it to your preferred folder.</p>
          <div className="flex gap-2">
            <a href={previewUrl} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:flex-none">
              <IconGlyph icon={ExternalLink} size={14} />
              Open tab
            </a>
            <SaveAsButton scan={scan} />
          </div>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

function emptySubscribe() {
  return () => {};
}

function SaveAsButton({ scan, fullWidth = false }: { scan: ScanFile; fullWidth?: boolean }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveAs() {
    const picker = (window as Window & { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
    if (!picker) {
      const link = document.createElement("a");
      link.href = `/api/printops/scans/${scan.id}`;
      link.download = scan.name;
      link.click();
      return;
    }

    setSaving(true);
    setError("");
    try {
      const extension = scan.name.includes(".") ? `.${scan.name.split(".").pop()}` : ".pdf";
      const handle = await picker({
        suggestedName: scan.name,
        types: [{
          description: "Scanned document",
          accept: { [scan.mimeType || "application/pdf"]: [extension] },
        }],
      });
      const response = await fetch(`/api/printops/scans/${scan.id}`);
      if (!response.ok) throw new Error("The scan file could not be downloaded.");
      const writable = await handle.createWritable();
      await writable.write(await response.blob());
      await writable.close();
    } catch (saveError) {
      if (saveError instanceof DOMException && saveError.name === "AbortError") return;
      setError(saveError instanceof Error ? saveError.message : "The scan could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={fullWidth ? "flex-1" : ""}>
      <button
        type="button"
        onClick={() => void saveAs()}
        disabled={saving}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-65 ${fullWidth ? "w-full" : ""}`}
      >
        <IconGlyph icon={Download} size={14} />
        {saving ? "Saving…" : "Save as…"}
      </button>
      {error && <p className="mt-1 max-w-48 text-left text-[10px] leading-4 text-red-600">{error}</p>}
    </div>
  );
}
