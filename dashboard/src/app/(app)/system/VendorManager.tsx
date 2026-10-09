"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide";
import { MorphIcon } from "morphicons/react";
import DeleteButton from "@/components/DeleteButton";
import { Input, PrimaryButton, SecondaryButton } from "@/components/ui";
import SystemDrawer from "./SystemDrawer";

type Vendor = { id: number; name: string; email: string | null; mobile: string | null; accountManager: string | null };

export default function VendorManager({ vendors, addAction, updateAction, deleteAction, readOnly = false }: {
  vendors: Vendor[];
  addAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const filtered = useMemo(() => vendors.filter((vendor) => `${vendor.name} ${vendor.email ?? ""} ${vendor.mobile ?? ""} ${vendor.accountManager ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [query, vendors]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-sm font-bold text-[#014171]">Vendors and suppliers</h2><p className="mt-1 text-xs text-slate-500">Service-provider contact and account-management records.</p></div>
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:w-60 sm:flex-none"><MorphIcon icon={Search} size={15} strokeWidth={2} reducedMotion="user" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search suppliers" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15" /></label>
          {!readOnly && <PrimaryButton type="button" onClick={() => setAdding(true)}><MorphIcon icon={Plus} size={15} strokeWidth={2} reducedMotion="user" />Add Vendor</PrimaryButton>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-4 py-3">Vendor / Supplier</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Account Manager</th><th className="w-40 px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((vendor) => <tr key={vendor.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-semibold text-slate-800">{vendor.name}</td><td className="px-4 py-3.5 text-slate-600">{vendor.email || "—"}</td><td className="whitespace-nowrap px-4 py-3.5 text-slate-600">{vendor.mobile || "—"}</td><td className="px-4 py-3.5 text-slate-600">{vendor.accountManager || "—"}</td><td className="px-4 py-3 text-right">{!readOnly && <div className="inline-flex items-center gap-2"><button type="button" onClick={() => setEditing(vendor)} aria-label={`Edit ${vendor.name}`} title="Edit vendor" className="flex size-9 items-center justify-center rounded-lg text-[#014171] transition hover:bg-sky-50"><MorphIcon icon={Pencil} size={16} strokeWidth={2} reducedMotion="user" /></button><DeleteButton action={deleteAction} id={vendor.id} label={`Delete ${vendor.name}`} iconOnly confirmText={`Delete vendor "${vendor.name}"?`} className="size-9 rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100" /></div>}</td></tr>)}
            {!filtered.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">No matching suppliers.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 shrink-0 text-xs font-medium text-slate-500">{filtered.length} of {vendors.length} records</p>

      <VendorDrawer open={adding} title="Add Vendor / Supplier" onClose={() => setAdding(false)} action={addAction} />
      {editing && <VendorDrawer open title="Edit Vendor / Supplier" onClose={() => setEditing(null)} action={updateAction} vendor={editing} />}
    </div>
  );
}

function VendorDrawer({ open, title, onClose, action, vendor }: { open: boolean; title: string; onClose: () => void; action: (formData: FormData) => void | Promise<void>; vendor?: Vendor }) {
  return <SystemDrawer open={open} title={title} subtitle="Supplier contact information" onClose={onClose} width="max-w-2xl">
    <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2"><Input label="Vendor name" name="name" defaultValue={vendor?.name ?? ""} required floatingLabel /></div>
        <Input label="Email address" name="email" type="email" defaultValue={vendor?.email ?? ""} floatingLabel />
        <Input label="Mobile number" name="mobile" defaultValue={vendor?.mobile ?? ""} floatingLabel />
        <div className="sm:col-span-2"><Input label="Account manager" name="accountManager" defaultValue={vendor?.accountManager ?? ""} floatingLabel /></div>
      </div>
      <div className="mt-5 flex justify-end gap-2"><SecondaryButton type="button" onClick={onClose}>Cancel</SecondaryButton><PrimaryButton type="submit">{vendor ? "Save changes" : "Add vendor"}</PrimaryButton></div>
    </form>
  </SystemDrawer>;
}
