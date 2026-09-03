"use client";

import { useState } from "react";
import { BellRing, Droplets, Pencil, Plus, Save, X } from "lucide";
import { MorphIcon } from "morphicons/react";
import DeleteButton from "@/components/DeleteButton";
import { PrimaryButton, SecondaryButton } from "@/components/ui";

type TonerType = { id: number; name: string; stock: number; threshold: number; criticalThreshold: number; showAlertCard: boolean };

export default function TonerTypeManager({
  items,
  addAction,
  updateAction,
  deleteAction,
  thresholdAction,
  visibilityAction,
  isAdmin,
}: {
  items: TonerType[];
  addAction: (formData: FormData) => void | Promise<void>;
  updateAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  thresholdAction: (formData: FormData) => void | Promise<void>;
  visibilityAction: (formData: FormData) => void | Promise<void>;
  isAdmin: boolean;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 items-end justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <MorphIcon icon={Droplets} size={18} strokeWidth={2} reducedMotion="user" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#014171]">Toner types</h2>
            <p className="mt-0.5 text-xs text-slate-500">Inventory labels, thresholds, and dashboard alert visibility.</p>
          </div>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">{items.length} types</span>
      </div>

      <form action={addAction} className="mb-5 flex shrink-0 flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 sm:flex-row">
        <label className="min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">Toner type name</span>
          <input name="name" required disabled={!isAdmin} placeholder="e.g. TN263 B" className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:cursor-not-allowed disabled:bg-slate-100" />
        </label>
        <PrimaryButton type="submit" disabled={!isAdmin} className="min-h-10 py-2">
          <MorphIcon icon={Plus} size={15} strokeWidth={2} reducedMotion="user" />
          Add Toner Type
        </PrimaryButton>
      </form>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pr-1">
        {items.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm font-medium text-slate-400">No toner types yet.</p>}
        {items.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {editingId === t.id ? (
                <form action={updateAction} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <input type="hidden" name="id" value={t.id} />
                  <input name="name" defaultValue={t.name} className="h-9 w-full rounded-xl border border-slate-300 px-3 text-sm shadow-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 sm:max-w-sm" />
                  <PrimaryButton type="submit" className="min-h-9 px-3 py-1.5 text-xs"><MorphIcon icon={Save} size={13} strokeWidth={2} reducedMotion="user" />Save</PrimaryButton>
                  <SecondaryButton type="button" className="px-3 py-1.5 text-xs" onClick={() => setEditingId(null)}><MorphIcon icon={X} size={13} strokeWidth={2} reducedMotion="user" />Cancel</SecondaryButton>
                </form>
              ) : (
                <div className="w-full">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                        <MorphIcon icon={Droplets} size={16} strokeWidth={2} reducedMotion="user" />
                      </span>
                      <div>
                        <p className="font-bold text-[#014171]">{t.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">Stock on hand: <strong className="text-slate-700">{t.stock}</strong></p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button disabled={!isAdmin} onClick={() => setEditingId(t.id)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"><MorphIcon icon={Pencil} size={12} strokeWidth={2} reducedMotion="user" />Rename</button>
                      {isAdmin ? <DeleteButton action={deleteAction} id={t.id} confirmText={`Delete toner type "${t.name}"? Its dashboard alert card will be removed.`} className="rounded-xl border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100" /> : <button type="button" disabled className="rounded-xl border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-400">Delete</button>}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <form action={visibilityAction} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                      <input type="hidden" name="tonerTypeId" value={t.id} />
                      <label className="flex min-w-0 flex-1 items-center gap-2 text-xs font-semibold text-slate-600">
                        <MorphIcon icon={BellRing} size={14} strokeWidth={2} reducedMotion="user" />
                        <input type="checkbox" name="showAlertCard" defaultChecked={t.showAlertCard} disabled={!isAdmin} className="size-4 rounded border-slate-300 text-[#014171]" />
                        Show alert cards
                      </label>
                      <SecondaryButton type="submit" disabled={!isAdmin} className="px-2.5 py-1 text-xs">Save</SecondaryButton>
                    </form>
                    <form action={thresholdAction} className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                      <input type="hidden" name="tonerTypeId" value={t.id} />
                      <label className="text-[11px] font-semibold text-slate-500">Low<input type="number" name="threshold" min="0" defaultValue={t.threshold} className="mt-1 block h-8 w-20 rounded-lg border border-slate-300 bg-white px-2 text-xs shadow-sm" /></label>
                      <label className="text-[11px] font-semibold text-slate-500">Critical<input type="number" name="criticalThreshold" min="0" max={t.threshold} defaultValue={t.criticalThreshold} className="mt-1 block h-8 w-20 rounded-lg border border-slate-300 bg-white px-2 text-xs shadow-sm" /></label>
                      <SecondaryButton type="submit" className="px-2.5 py-1 text-xs">Update</SecondaryButton>
                    </form>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
