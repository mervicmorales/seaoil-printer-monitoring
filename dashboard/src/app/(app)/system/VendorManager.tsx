"use client";

import { useState } from "react";
import DeleteButton from "@/components/DeleteButton";
import { Input, PrimaryButton, SecondaryButton } from "@/components/ui";

type Vendor = { id: number; name: string; email: string | null; mobile: string | null; accountManager: string | null };

export default function VendorManager({
  vendors,
  addAction,
  updateAction,
  deleteAction,
  readOnly = false,
}: {
  vendors: Vendor[];
  addAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {!readOnly && <form action={addAction} className="mb-6 grid shrink-0 grid-cols-1 gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input name="name" placeholder="Vendor Name" required />
        <Input name="email" type="email" placeholder="Vendor Email Address" />
        <Input name="mobile" placeholder="Vendor Mobile Number" />
        <Input name="accountManager" placeholder="Account Manager" />
        <div className="lg:col-span-4">
          <PrimaryButton type="submit">Add Vendor</PrimaryButton>
        </div>
      </form>}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {vendors.length === 0 && <p className="text-sm text-slate-400">No vendors added yet.</p>}
        {vendors.map((v) => (
          <div key={v.id} className="rounded-lg border border-slate-200 p-4">
            {editingId === v.id ? (
              <form action={updateAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="id" value={v.id} />
                <Input name="name" defaultValue={v.name} required />
                <Input name="email" type="email" defaultValue={v.email ?? ""} />
                <Input name="mobile" defaultValue={v.mobile ?? ""} />
                <Input name="accountManager" defaultValue={v.accountManager ?? ""} />
                <div className="flex gap-2 lg:col-span-4">
                  <PrimaryButton type="submit" className="px-3 py-1.5 text-xs">Save</PrimaryButton>
                  <SecondaryButton type="button" className="px-3 py-1.5 text-xs" onClick={() => setEditingId(null)}>Cancel</SecondaryButton>
                </div>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#014171]">{v.name}</p>
                  <p className="text-xs text-slate-500">{v.email || "—"} · {v.mobile || "—"} · {v.accountManager || "—"}</p>
                </div>
                {!readOnly && <div className="flex gap-2">
                  <button onClick={() => setEditingId(v.id)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">Edit</button>
                  <DeleteButton action={deleteAction} id={v.id} confirmText={`Delete vendor "${v.name}"?`} />
                </div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
