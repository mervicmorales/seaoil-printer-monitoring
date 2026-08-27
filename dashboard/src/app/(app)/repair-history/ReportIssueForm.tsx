"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input, Textarea, PrimaryButton, SecondaryButton } from "@/components/ui";
import type { RepairFormState } from "./actions";
import Link from "next/link";
import { notifyActionPromise } from "@/lib/toast-notifications";
import SearchInput from "@/components/SearchInput";

type Lookup = { id: number; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending}>
      {pending ? "Submitting..." : "Submit Report"}
    </PrimaryButton>
  );
}

export default function ReportIssueForm({
  action,
  locations,
  departments,
  vendors,
  today,
}: {
  action: (prev: RepairFormState, formData: FormData) => Promise<RepairFormState>;
  locations: Lookup[];
  departments: Lookup[];
  vendors: Lookup[];
  today: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [locationId, setLocationId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [lookupMsg, setLookupMsg] = useState("");
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "not-found" | "error">("idle");
  const lookupSequence = useRef(0);

  function clearPrinterLookup() {
    lookupSequence.current += 1;
    setLocationId("");
    setDepartmentId("");
    setVendorId("");
    setLookupMsg("");
    setLookupState("idle");
  }

  async function handleSerialBlur(e: React.FocusEvent<HTMLInputElement>) {
    const serial = e.target.value.trim();
    if (!serial) {
      clearPrinterLookup();
      return;
    }

    const requestNumber = ++lookupSequence.current;
    setLookupState("loading");
    setLookupMsg("");
    try {
      const request = fetch(`/api/printers/lookup?serial=${encodeURIComponent(serial)}`).then(
        async (response) => {
          if (!response.ok) throw new Error("PrinterLookupFailed");
          return response.json();
        },
      );
      const notificationRequest = request.then((data) => {
        if (!data.found) throw new Error("PrinterNotFound");
        return data;
      });
      notifyActionPromise(notificationRequest, {
        loading: "Looking up printer",
        success: "Printer lookup completed",
        error: (error) =>
          error instanceof Error && error.message === "PrinterNotFound"
            ? "No Printer Serial Found on the Records"
            : "Printer lookup failed",
      });
      const data = await request;
      if (requestNumber !== lookupSequence.current) return;

      if (data.found) {
        setLocationId(data.locationId ? String(data.locationId) : "");
        setDepartmentId(data.departmentId ? String(data.departmentId) : "");
        setVendorId(data.vendorId ? String(data.vendorId) : "");
        setLookupMsg(`Printer found. Department, Location and Vendor auto-filled.`);
        setLookupState("found");
      } else {
        setLocationId("");
        setDepartmentId("");
        setVendorId("");
        setLookupMsg("No printer serial found in the records.");
        setLookupState("not-found");
      }
    } catch {
      if (requestNumber !== lookupSequence.current) return;
      setLookupMsg("Printer lookup failed. Try again.");
      setLookupState("error");
    }
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SearchInput
          label="Printer Serial Number"
          name="serialNumber"
          placeholder="Search printer serial number"
          aria-label="Search printer by serial number"
          required
          onBlur={handleSerialBlur}
          loading={lookupState === "loading"}
          submitOnClear={false}
          onClear={clearPrinterLookup}
          error={
            state.fieldErrors?.serialNumber ??
            (lookupState === "not-found" || lookupState === "error" ? lookupMsg : null)
          }
        />
        <Input label="Requested Date" name="requestedDate" type="date" defaultValue={today} required error={state.fieldErrors?.requestedDate} />
        <input type="hidden" name="departmentId" value={departmentId} />
        <Input
          label="Department"
          value={departments.find((item) => String(item.id) === departmentId)?.name ?? ""}
          placeholder="Auto-filled from printer inventory"
          readOnly
          disabled
          className="bg-slate-100 text-slate-600"
        />
        <input type="hidden" name="locationId" value={locationId} />
        <Input
          label="Location"
          value={locations.find((item) => String(item.id) === locationId)?.name ?? ""}
          placeholder="Auto-filled from printer inventory"
          readOnly
          disabled
          className="bg-slate-100 text-slate-600"
        />
        <input type="hidden" name="vendorId" value={vendorId} />
        <Input
          label="Vendor"
          value={vendors.find((item) => String(item.id) === vendorId)?.name ?? ""}
          placeholder="Auto-filled from printer inventory"
          readOnly
          disabled
          className="bg-slate-100 text-slate-600"
        />
      </div>
      {lookupMsg && lookupState === "found" ? (
        <p className="text-xs text-[#014171]" role="status" aria-live="polite">
          {lookupMsg}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Textarea label="Concern" name="problem" rows={4} required error={state.fieldErrors?.problem} />
        <Textarea label="Remarks" name="remarks" rows={4} />
      </div>
      <div className="flex gap-3">
        <SubmitButton />
        <Link href="/repair-history"><SecondaryButton type="button">Cancel</SecondaryButton></Link>
      </div>
    </form>
  );
}
