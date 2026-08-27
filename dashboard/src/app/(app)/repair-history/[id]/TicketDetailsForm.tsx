"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
import { PrimaryButton, Textarea } from "@/components/ui";
import { notifyActionSuccess } from "@/lib/toast-notifications";
import type { RepairFormState } from "../actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Changes"}
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
}: {
  action: (prev: RepairFormState, formData: FormData) => Promise<RepairFormState>;
  ticketId: number;
  status: string;
  problem: string;
  remarks: string | null;
  resolution: string | null;
  resolutionAttachmentUrl: string | null;
  resolutionAttachmentName: string | null;
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
    <form id="repair-ticket-details-form" action={formAction} className="mt-6 space-y-4 border-t border-slate-100 pt-6">
      <input type="hidden" name="id" value={ticketId} />
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.fieldErrors?.status && <p className="text-sm text-red-600">{state.fieldErrors.status}</p>}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Textarea
          label="Concern"
          name="problem"
          rows={3}
          defaultValue={problem}
          required
          error={state.fieldErrors?.problem}
        />
        <Textarea
          label="Resolution"
          name="resolution"
          rows={3}
          defaultValue={resolution ?? ""}
          required={selectedStatus === "Closed"}
          error={state.fieldErrors?.resolution}
        />
        <Textarea
          label="Remarks"
          name="remarks"
          rows={3}
          defaultValue={remarks ?? ""}
        />
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="resolution-attachment">
            Resolution Attachment
          </label>
          <input
            id="resolution-attachment"
            type="file"
            name="resolutionAttachment"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
          <p className="mt-1 text-xs text-slate-400">JPEG, PNG, or WebP up to 5 MB.</p>
          {resolutionAttachmentUrl && (
            <a
              href={resolutionAttachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-sm font-medium text-[#014171] underline"
            >
              {resolutionAttachmentName || "View current attachment"}
            </a>
          )}
        </div>
      </div>
      <SubmitButton />
    </form>
  );
}
