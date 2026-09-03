"use client";

import { useState } from "react";
import { Pencil, Plus, Save, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import DeleteButton from "@/components/DeleteButton";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

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
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className={fillHeight ? "flex h-full min-h-0 flex-col" : ""}>
      <div className={`mb-4 flex items-end justify-between gap-4 ${fillHeight ? "shrink-0" : ""}`}>
        <div>
          <h2 className="text-sm font-bold text-[#014171]">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">{items.length} records</span>
      </div>
      {!readOnly && <form action={addAction} className={`mb-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:flex-row ${fillHeight ? "shrink-0" : ""}`}>
        <input
          name="name"
          required
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 sm:max-w-sm"
        />
        <PrimaryButton type="submit" className="min-h-10 py-2">
          <MorphIcon icon={Plus} size={15} strokeWidth={2} reducedMotion="user" />
          Add
        </PrimaryButton>
      </form>}
      <div className={`divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white ${fillHeight ? "min-h-0 flex-1 overflow-y-auto overscroll-contain" : ""}`}>
        {items.length === 0 && <p className="px-4 py-10 text-center text-sm font-medium text-slate-400">No records yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50/70">
            {editingId === item.id && editable && updateAction ? (
              <form action={updateAction} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <input type="hidden" name="id" value={item.id} />
                <input
                  name="name"
                  defaultValue={item.name}
                  className="h-9 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm shadow-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 sm:max-w-sm"
                />
                <PrimaryButton type="submit" className="min-h-9 px-3 py-1.5 text-xs">
                  <MorphIcon icon={Save} size={13} strokeWidth={2} reducedMotion="user" />
                  Save
                </PrimaryButton>
                <SecondaryButton type="button" className="px-3 py-1.5 text-xs" onClick={() => setEditingId(null)}>
                  <MorphIcon icon={X} size={13} strokeWidth={2} reducedMotion="user" />
                  Cancel
                </SecondaryButton>
              </form>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700">{item.name}</p>
                <div className="flex gap-2">
                  {!readOnly && editable && updateAction && (
                    <button
                      onClick={() => setEditingId(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50"
                    >
                      <MorphIcon icon={Pencil} size={12} strokeWidth={2} reducedMotion="user" />
                      Edit
                    </button>
                  )}
                  {!readOnly && <DeleteButton action={deleteAction} id={item.id} confirmText={`Delete "${item.name}"?`} className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100" />}
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
