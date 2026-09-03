"use client";

import { useState } from "react";
import { Mail, Pencil, Phone, Plus, Save, Truck, UserRound, X } from "lucide";
import { MorphIcon } from "morphicons/react";
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
      <div className="mb-4 flex shrink-0 items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <MorphIcon icon={Truck} size={18} strokeWidth={2} reducedMotion="user" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#014171]">Vendors and suppliers</h2>
            <p className="mt-0.5 text-xs text-slate-500">Service-provider contact and account-management records.</p>
          </div>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">{vendors.length} records</span>
      </div>

      {!readOnly && <form action={addAction} className="mb-5 grid shrink-0 grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Input label="Vendor name" name="name" placeholder="Vendor Name" required />
        <Input label="Email address" name="email" type="email" placeholder="Vendor Email Address" />
        <Input label="Mobile number" name="mobile" placeholder="Vendor Mobile Number" />
        <Input label="Account manager" name="accountManager" placeholder="Account Manager" />
        <div className="lg:col-span-4">
          <PrimaryButton type="submit">
            <MorphIcon icon={Plus} size={15} strokeWidth={2} reducedMotion="user" />
            Add Vendor
          </PrimaryButton>
        </div>
      </form>}

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        {vendors.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-400">No vendors added yet.</p>}
        {vendors.map((v) => (
          <div key={v.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
            {editingId === v.id ? (
              <form action={updateAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <input type="hidden" name="id" value={v.id} />
                <Input label="Vendor name" name="name" defaultValue={v.name} required />
                <Input label="Email address" name="email" type="email" defaultValue={v.email ?? ""} />
                <Input label="Mobile number" name="mobile" defaultValue={v.mobile ?? ""} />
                <Input label="Account manager" name="accountManager" defaultValue={v.accountManager ?? ""} />
                <div className="flex gap-2 lg:col-span-4">
                  <PrimaryButton type="submit" className="px-3 py-1.5 text-xs"><MorphIcon icon={Save} size={13} strokeWidth={2} reducedMotion="user" />Save</PrimaryButton>
                  <SecondaryButton type="button" className="px-3 py-1.5 text-xs" onClick={() => setEditingId(null)}><MorphIcon icon={X} size={13} strokeWidth={2} reducedMotion="user" />Cancel</SecondaryButton>
                </div>
              </form>
            ) : (
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div className="min-w-0">
                  <p className="font-bold text-[#014171]">{v.name}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><MorphIcon icon={Mail} size={13} strokeWidth={2} reducedMotion="user" />{v.email || "—"}</span>
                    <span className="inline-flex items-center gap-1.5"><MorphIcon icon={Phone} size={13} strokeWidth={2} reducedMotion="user" />{v.mobile || "—"}</span>
                    <span className="inline-flex items-center gap-1.5"><MorphIcon icon={UserRound} size={13} strokeWidth={2} reducedMotion="user" />{v.accountManager || "—"}</span>
                  </div>
                </div>
                {!readOnly && <div className="flex gap-2">
                  <button onClick={() => setEditingId(v.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"><MorphIcon icon={Pencil} size={12} strokeWidth={2} reducedMotion="user" />Edit</button>
                  <DeleteButton action={deleteAction} id={v.id} confirmText={`Delete vendor "${v.name}"?`} className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100" />
                </div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
