"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, LoaderCircle, Upload } from "lucide";
import { MorphIcon } from "morphicons/react";
import { PrimaryButton } from "@/components/ui";
import {
  confirmOrganizationImportAction,
  previewOrganizationImportAction,
  type OrganizationImportState,
} from "./organization-import-actions";

function PreviewButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      <MorphIcon icon={pending ? LoaderCircle : Upload} size={16} strokeWidth={2} reducedMotion="user" className={pending ? "animate-spin" : ""} />
      {pending ? "Validating…" : "Validate and preview"}
    </PrimaryButton>
  );
}

export default function OrganizationImportManager() {
  const [state, previewAction] = useActionState<OrganizationImportState, FormData>(previewOrganizationImportAction, {});
  const summary = state.summary;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <div>
        <h2 className="text-sm font-bold text-[#014171]">Import organizational data</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          Upload an .xlsx workbook using the Collated data sheet and Department, Subunit, Office, and Cost Center columns. Nothing is saved until you confirm the preview.
        </p>
      </div>

      <form action={previewAction} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <label htmlFor="organization-workbook" className="mb-2 block text-sm font-semibold text-slate-700">Excel workbook</label>
        <input
          id="organization-workbook"
          type="file"
          name="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 shadow-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700"
        />
        <div className="mt-3 flex justify-end"><PreviewButton /></div>
      </form>

      {state.error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <MorphIcon icon={AlertTriangle} size={17} strokeWidth={2} reducedMotion="user" className="mt-0.5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {summary && (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-4">
            <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <MorphIcon icon={FileSpreadsheet} size={18} strokeWidth={2} reducedMotion="user" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Import preview</h3>
              <p className="mt-0.5 text-xs text-slate-500">{state.filename}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-3 lg:grid-cols-4">
            <Metric label="Populated rows" value={summary.totalRows} />
            <Metric label="Valid rows" value={summary.validRows} />
            <Metric label="New offices" value={summary.newLocations} />
            <Metric label="New departments" value={summary.newDepartments} />
            <Metric label="New subunits" value={summary.newSubunits} />
            <Metric label="New cost centers" value={summary.newCostCenters} />
            <Metric label="New mappings" value={summary.newMappings} />
            <Metric label="Records to update" value={summary.recordsToUpdate} />
            <Metric label="Existing / unchanged" value={summary.unchanged} />
            <Metric label="Duplicate rows" value={summary.duplicateRows} tone={summary.duplicateRows ? "warning" : "neutral"} />
            <Metric label="Invalid rows" value={summary.invalidRows} tone={summary.invalidRows ? "danger" : "neutral"} />
            <Metric label="Conflicts" value={summary.conflicts} tone={summary.conflicts ? "danger" : "neutral"} />
          </div>

          {summary.issues.length > 0 && (
            <div className="border-t border-slate-200 p-4">
              <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Rows requiring attention</h4>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/50">
                {summary.issues.map((issue, index) => (
                  <p key={`${issue.rowNumber}-${index}`} className="border-b border-amber-100 px-3 py-2 text-xs text-amber-900 last:border-b-0">
                    <strong>Row {issue.rowNumber}:</strong> {issue.message}
                  </p>
                ))}
              </div>
            </div>
          )}

          {state.importId && (
            <form action={confirmOrganizationImportAction} className="flex flex-col gap-3 border-t border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <input type="hidden" name="importId" value={state.importId} />
              <p className="flex items-center gap-2 text-xs text-slate-600">
                <MorphIcon icon={CheckCircle2} size={15} strokeWidth={2} reducedMotion="user" className="text-emerald-600" />
                Invalid and duplicate rows will be skipped. Existing records will not be deleted.
              </p>
              <PrimaryButton type="submit">Confirm import</PrimaryButton>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "warning" | "danger" }) {
  const valueClass = tone === "danger" ? "text-red-700" : tone === "warning" ? "text-amber-700" : "text-[#014171]";
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}
