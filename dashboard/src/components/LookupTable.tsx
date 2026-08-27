"use client";

import { useState } from "react";
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
  fillHeight = false,
}: {
  items: Item[];
  addAction: (formData: FormData) => void | Promise<void>;
  updateAction?: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  placeholder?: string;
  editable?: boolean;
  fillHeight?: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className={fillHeight ? "flex h-full min-h-0 flex-col" : ""}>
      <form action={addAction} className={`mb-4 flex gap-2 ${fillHeight ? "shrink-0" : ""}`}>
        <input
          name="name"
          required
          placeholder={placeholder}
          className="w-full max-w-sm rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40"
        />
        <PrimaryButton type="submit">Add</PrimaryButton>
      </form>
      <div className={`divide-y divide-slate-100 rounded-lg border border-slate-200 ${fillHeight ? "min-h-0 flex-1 overflow-y-auto" : ""}`}>
        {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-400">No records yet.</p>}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            {editingId === item.id && editable && updateAction ? (
              <form action={updateAction} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={item.id} />
                <input
                  name="name"
                  defaultValue={item.name}
                  className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                />
                <PrimaryButton type="submit" className="px-3 py-1.5 text-xs">Save</PrimaryButton>
                <SecondaryButton type="button" className="px-3 py-1.5 text-xs" onClick={() => setEditingId(null)}>
                  Cancel
                </SecondaryButton>
              </form>
            ) : (
              <>
                <p className="text-sm text-slate-700">{item.name}</p>
                <div className="flex gap-2">
                  {editable && updateAction && (
                    <button
                      onClick={() => setEditingId(item.id)}
                      className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  )}
                  <DeleteButton action={deleteAction} id={item.id} confirmText={`Delete "${item.name}"?`} />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
