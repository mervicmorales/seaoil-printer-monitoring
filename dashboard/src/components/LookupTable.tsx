"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Search } from "lucide";
import { MorphIcon } from "morphicons/react";
import DeleteButton from "@/components/DeleteButton";
import { Input, PrimaryButton, SecondaryButton } from "@/components/ui";
import SystemDrawer from "@/app/(app)/system/SystemDrawer";

type Item = { id: number; name: string };

export default function LookupTable({
  items,
  addAction,
  updateAction,
  deleteAction,
  placeholder = "Enter name",
  editable = true,
  readOnly = false,
  fillHeight = false,
  title = "Reference records",
  description = "Manage the values available throughout the system.",
}: {
  items: Item[];
  addAction: (formData: FormData) => void | Promise<void>;
  updateAction?: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  placeholder?: string;
  editable?: boolean;
  readOnly?: boolean;
  fillHeight?: boolean;
  title?: string;
  description?: string;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);
  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);

  return (
    <div className={fillHeight ? "flex h-full min-h-0 flex-col" : ""}>
      <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-[#014171]">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <MorphIcon icon={Search} size={15} strokeWidth={2} reducedMotion="user" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15" />
          </label>
          {!readOnly && <PrimaryButton type="button" onClick={() => setAdding(true)}><MorphIcon icon={Plus} size={15} strokeWidth={2} reducedMotion="user" />Add</PrimaryButton>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.08em] text-slate-500">
            <tr><th className="px-4 py-3">Name</th><th className="w-40 px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => (
              <tr key={item.id} className="transition hover:bg-slate-50/70">
                <td className="px-4 py-3.5 font-semibold text-slate-700">{item.name}</td>
                <td className="px-4 py-3 text-right">
                  {!readOnly && <div className="inline-flex items-center justify-end gap-2">
                    {editable && updateAction && <button type="button" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`} className="flex size-9 items-center justify-center rounded-lg text-[#014171] transition hover:bg-sky-50"><MorphIcon icon={Pencil} size={16} strokeWidth={2} reducedMotion="user" /></button>}
                    <DeleteButton action={deleteAction} id={item.id} label={`Delete ${item.name}`} iconOnly confirmText={`Delete "${item.name}"?`} className="size-9 rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100" />
                  </div>}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={2} className="px-4 py-12 text-center text-sm text-slate-400">No matching records.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 shrink-0 text-xs font-medium text-slate-500">{filtered.length} of {items.length} records</p>

      <SystemDrawer open={adding} title={`Add ${title.replace(/s$/i, "")}`} subtitle="Create a new reference record" onClose={() => setAdding(false)}>
        <form action={addAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Input label="Name" name="name" placeholder={placeholder} required floatingLabel />
          <div className="mt-5 flex justify-end gap-2"><SecondaryButton type="button" onClick={() => setAdding(false)}>Cancel</SecondaryButton><PrimaryButton type="submit">Add record</PrimaryButton></div>
        </form>
      </SystemDrawer>

      {editing && updateAction && <SystemDrawer open title={`Edit ${title.replace(/s$/i, "")}`} subtitle="Update this reference record" onClose={() => setEditing(null)}>
        <form action={updateAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <input type="hidden" name="id" value={editing.id} />
          <Input label="Name" name="name" defaultValue={editing.name} required floatingLabel />
          <div className="mt-5 flex justify-end gap-2"><SecondaryButton type="button" onClick={() => setEditing(null)}>Cancel</SecondaryButton><PrimaryButton type="submit">Save changes</PrimaryButton></div>
        </form>
      </SystemDrawer>}
    </div>
  );
}
