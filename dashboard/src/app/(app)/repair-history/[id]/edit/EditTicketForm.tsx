"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { ClipboardCheck, Paperclip, Wrench, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
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
    <PrimaryButton type="submit" disabled={pending} className="!h-8 !min-h-8 rounded-lg px-3 py-0 text-xs shadow-none">
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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.error}</div>
      )}
      <section>
        <FormSectionHeader
          icon={Wrench}
          title="Ticket and assignment"
          description="Repair reference, printer identity, and service ownership"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
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
      </section>
      <section>
        <FormSectionHeader
          icon={ClipboardCheck}
          title="Issue and resolution"
          description="Update the reported concern and document completed work"
        />
      <div className="mt-4 grid grid-cols-1 gap-5 rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5 lg:grid-cols-2">
        <Textarea label="Concern" name="problem" rows={5} defaultValue={ticket.problem} required />
        <div className="space-y-4">
          <Textarea
            label="Resolution"
            name="resolution"
            rows={3}
            defaultValue={ticket.resolution ?? ""}
            error={state.fieldErrors?.resolution}
          />
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700" htmlFor="edit-resolution-attachment">
              <MorphIcon icon={Paperclip} size={16} strokeWidth={2} reducedMotion="user" />
              Resolution Attachment
            </label>
            <input
              id="edit-resolution-attachment"
              type="file"
              name="resolutionAttachment"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-600 shadow-sm file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
            />
            {ticket.resolutionAttachmentUrl && (
              <a
                href={ticket.resolutionAttachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-[#014171] shadow-sm transition hover:bg-sky-100"
              >
                <MorphIcon icon={Paperclip} size={14} strokeWidth={2} reducedMotion="user" />
                {ticket.resolutionAttachmentName || "View current attachment"}
              </a>
            )}
          </div>
        </div>
      </div>
      </section>
      <div className="flex gap-3 border-t border-slate-200 pt-5">
        <SubmitButton />
        <Link href="/repair-history"><SecondaryButton type="button">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}

function FormSectionHeader({
  icon,
  title,
  description,
}: {
  icon: IconNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
        <MorphIcon icon={icon} size={17} strokeWidth={2} reducedMotion="user" />
      </span>
      <div className="min-w-0">
        <h3 className="text-sm font-bold text-[#014171]">{title}</h3>
        <p className="mt-0.5 text-xs text-slate-500">{description}</p>
      </div>
    </div>
  );
}
