"use client";

import { useState } from "react";
import DeleteButton from "@/components/DeleteButton";
import { Input, PrimaryButton, SecondaryButton } from "@/components/ui";

type TonerType = { id: number; name: string; stock: number; threshold: number; showAlertCard: boolean };

export default function TonerTypeManager({
  items,
  addAction,
  updateAction,
  deleteAction,
  thresholdAction,
  visibilityAction,
}: {
  items: TonerType[];
  addAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  thresholdAction: (formData: FormData) => void | Promise<void>;
  visibilityAction: (formData: FormData) => void | Promise<void>;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <form action={addAction} className="mb-6 flex shrink-0 gap-2">
        <input name="name" required placeholder="e.g. TN263 B" className="w-full max-w-sm rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm" />
        <PrimaryButton type="submit">Add Toner Type</PrimaryButton>
      </form>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {items.length === 0 && <p className="text-sm text-slate-400">No toner types yet.</p>}
        {items.map((t) => (
          <div key={t.id} className="rounded-lg border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {editingId === t.id ? (
                <form action={updateAction} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input name="name" defaultValue={t.name} className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-1.5 text-sm" />
                  <PrimaryButton type="submit" className="px-3 py-1.5 text-xs">Save</PrimaryButton>
                  <SecondaryButton type="button" className="px-3 py-1.5 text-xs" onClick={() => setEditingId(null)}>Cancel</SecondaryButton>
                </form>
              ) : (
                <>
                  <div>
                    <p className="font-semibold text-[#014171]">{t.name}</p>
                    <p className="text-xs text-slate-500">Stock on hand: {t.stock}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-4">
                    <form action={visibilityAction} className="flex items-center gap-2">
                      <input type="hidden" name="tonerTypeId" value={t.id} />
                      <label className="flex items-center gap-2 text-xs text-slate-600">
                        <input type="checkbox" name="showAlertCard" defaultChecked={t.showAlertCard} />
                        Show alert cards
                      </label>
                      <SecondaryButton type="submit" className="px-2.5 py-1 text-xs">Save</SecondaryButton>
                    </form>
                    <form action={thresholdAction} className="flex items-center gap-2">
                      <input type="hidden" name="tonerTypeId" value={t.id} />
                      <label className="text-xs text-slate-500">Low-stock threshold</label>
                      <input type="number" name="threshold" min="0" defaultValue={t.threshold} className="w-20 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
                      <SecondaryButton type="submit" className="px-2.5 py-1 text-xs">Update</SecondaryButton>
                    </form>
                    <button onClick={() => setEditingId(t.id)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">Rename</button>
                    <DeleteButton action={deleteAction} id={t.id} confirmText={`Delete toner type "${t.name}"? Its dashboard alert card will be removed.`} />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
