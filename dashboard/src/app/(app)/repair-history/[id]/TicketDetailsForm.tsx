"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { PrimaryButton, Textarea } from "@/components/ui";
import { notifyActionSuccess } from "@/lib/toast-notifications";
import type { RepairFormState } from "../actions";

function SubmitButton({ label = "Save Changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : label}
    </PrimaryButton>
  );
}

export default function TicketDetailsForm({
  action,
  ticketId,
  status,
  problem,
  remarks,
  resolution,
  resolutionAttachmentUrl,
  resolutionAttachmentName,
  statusOnly = false,
  showActions = true,
}: {
  action: (prev: RepairFormState, formData: FormData) => Promise<RepairFormState>;
  ticketId: number;
  status: string;
  problem: string;
  remarks: string | null;
  resolution: string | null;
  resolutionAttachmentUrl: string | null;
  resolutionAttachmentName: string | null;
  statusOnly?: boolean;
  showActions?: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const [selectedStatus, setSelectedStatus] = useState(status);
  const router = useRouter();

  useEffect(() => {
    if (!state.success) return;
    notifyActionSuccess(state.success);
    router.push("/repair-history");
  }, [router, state.success]);

  useEffect(() => {
    function handleStatusChange(event: Event) {
      const detail = (event as CustomEvent<{ formId: string; status: string }>).detail;
      if (detail.formId === "repair-ticket-details-form") {
        setSelectedStatus(detail.status);
      }
    }

    window.addEventListener("repair-ticket-status-change", handleStatusChange);
    return () => window.removeEventListener("repair-ticket-status-change", handleStatusChange);
  }, []);

  return (
    <form id="repair-ticket-details-form" action={formAction} className="border-t border-slate-200 bg-white p-5 sm:p-6">
      <input type="hidden" name="id" value={ticketId} />
      <div className="mb-5">
        <h2 className="text-sm font-semibold text-slate-900">Issue and resolution</h2>
        <p className="mt-1 text-xs text-slate-500">Review the reported concern and document the work completed.</p>
      </div>

      {(state.error || state.fieldErrors?.status) && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {state.error || state.fieldErrors?.status}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <Textarea
            label="Concern"
            name="problem"
            rows={4}
            defaultValue={problem}
            required
            readOnly={statusOnly}
            error={state.fieldErrors?.problem}
            className="min-h-28 resize-y bg-white read-only:cursor-default read-only:bg-slate-100 read-only:text-slate-600"
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <Textarea
            label="Resolution"
            name="resolution"
            rows={4}
            defaultValue={resolution ?? ""}
            required={!statusOnly && selectedStatus === "Closed"}
            readOnly={statusOnly}
            error={state.fieldErrors?.resolution}
            className="min-h-28 resize-y bg-white read-only:cursor-default read-only:bg-slate-100 read-only:text-slate-600"
          />
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <Textarea
            label="Remarks"
            name="remarks"
            rows={4}
            defaultValue={remarks ?? ""}
            readOnly={statusOnly}
            className="min-h-28 resize-y bg-white read-only:cursor-default read-only:bg-slate-100 read-only:text-slate-600"
          />
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="resolution-attachment">
            Resolution Attachment
          </label>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Add supporting proof of the completed repair. JPEG, PNG, or WebP up to 5 MB.
          </p>
          {!statusOnly && (
            <input
              id="resolution-attachment"
              type="file"
              name="resolutionAttachment"
              accept="image/jpeg,image/png,image/webp"
              className="mt-3 block w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
          )}
          {resolutionAttachmentUrl && (
            <a
              href={resolutionAttachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-[#014171] transition hover:bg-sky-100"
            >
              {resolutionAttachmentName || "View current attachment"}
            </a>
          )}
          {statusOnly && !resolutionAttachmentUrl && (
            <p className="mt-3 text-sm text-slate-400">No attachment uploaded.</p>
          )}
        </div>
      </div>
      {showActions && (
        <div className="mt-6 flex justify-end border-t border-slate-200 pt-5">
          <SubmitButton label={statusOnly ? "Save Status" : "Save Changes"} />
        </div>
      )}
    </form>
  );
}
