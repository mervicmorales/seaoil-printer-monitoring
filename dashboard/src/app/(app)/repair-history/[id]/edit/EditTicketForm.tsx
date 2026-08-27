"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Input, Select, Textarea, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { RepairFormState } from "../../actions";
import Link from "next/link";

type Lookup = { id: number; name: string };
type Ticket = {
  id: number;
  ticketNumber: string;
  serialNumber: string;
  requestedDate: string;
  departmentId: number | null;
  locationId: number | null;
  problem: string;
  vendorId: number | null;
  resolution: string | null;
  resolutionAttachmentUrl: string | null;
  resolutionAttachmentName: string | null;
  status: string;
  dateClosed: string | null;
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Saving..." : "Save Changes"}
    </PrimaryButton>
  );
}

export default function EditTicketForm({
  action,
  ticket,
  locations,
  departments,
  vendors,
}: {
  action: (prev: RepairFormState, formData: FormData) => Promise<RepairFormState>;
  ticket: Ticket;
  locations: Lookup[];
  departments: Lookup[];
  vendors: Lookup[];
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form id="repair-ticket-edit-form" action={formAction} className="space-y-5">
      <input type="hidden" name="id" value={ticket.id} />
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Input label="Ticket Number" value={ticket.ticketNumber} readOnly disabled className="bg-slate-100 text-slate-500" />
        <Input label="Serial Number" value={ticket.serialNumber} readOnly disabled className="bg-slate-100 text-slate-500" />
        <Input label="Requested Date" value={ticket.requestedDate} readOnly disabled className="bg-slate-100 text-slate-500" />
        <Select label="Department" name="departmentId" defaultValue={ticket.departmentId ?? ""}>
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </Select>
        <Select label="Location" name="locationId" defaultValue={ticket.locationId ?? ""}>
          <option value="">Select location</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        <Select label="Vendor" name="vendorId" defaultValue={ticket.vendorId ?? ""}>
          <option value="">Select vendor</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </Select>
        <Input label="Date Closed" name="dateClosed" type="date" defaultValue={ticket.dateClosed ?? ""} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Textarea label="Concern" name="problem" rows={5} defaultValue={ticket.problem} required />
        <div className="space-y-4">
          <Textarea
            label="Resolution"
            name="resolution"
            rows={3}
            defaultValue={ticket.resolution ?? ""}
            error={state.fieldErrors?.resolution}
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700" htmlFor="edit-resolution-attachment">
              Resolution Attachment
            </label>
            <input
              id="edit-resolution-attachment"
              type="file"
              name="resolutionAttachment"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
            {ticket.resolutionAttachmentUrl && (
              <a
                href={ticket.resolutionAttachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm font-medium text-[#014171] underline"
              >
                {ticket.resolutionAttachmentName || "View current attachment"}
              </a>
            )}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <SubmitButton />
        <Link href="/repair-history"><SecondaryButton type="button">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}
