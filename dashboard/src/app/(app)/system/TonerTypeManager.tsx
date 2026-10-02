"use client";

import { useMemo, useState } from "react";
import { BellRing, Pencil, Plus, Search } from "lucide";
import { MorphIcon } from "morphicons/react";
import DeleteButton from "@/components/DeleteButton";
import { Badge, Input, PrimaryButton, SecondaryButton } from "@/components/ui";
import SystemDrawer from "./SystemDrawer";

type TonerType = { id: number; name: string; unitCost: number; stock: number; threshold: number; criticalThreshold: number; showAlertCard: boolean };
type Action = (formData: FormData) => void | Promise<void>;
const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 });

export default function TonerTypeManager({ items, addAction, updateAction, deleteAction, thresholdAction, visibilityAction, isAdmin }: {
  items: TonerType[];
  addAction: Action;
  updateAction: Action;
  deleteAction: Action;
  thresholdAction: Action;
  visibilityAction: Action;
  isAdmin: boolean;
}) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<TonerType | null>(null);
  const filtered = useMemo(() => items.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())), [items, query]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-4 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><h2 className="text-sm font-bold text-[#014171]">Toner types</h2><p className="mt-1 text-xs text-slate-500">Inventory labels, pricing, thresholds, and dashboard alert visibility.</p></div>
        <div className="flex items-center gap-2"><label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none"><MorphIcon icon={Search} size={15} strokeWidth={2} reducedMotion="user" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search toner types" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15" /></label>{isAdmin && <PrimaryButton type="button" onClick={() => setAdding(true)}><MorphIcon icon={Plus} size={15} strokeWidth={2} reducedMotion="user" />Add Toner Type</PrimaryButton>}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-[0.08em] text-slate-500"><tr><th className="px-4 py-3">Toner Type</th><th className="px-4 py-3">Unit Cost</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Low / Critical</th><th className="px-4 py-3">Alert Card</th><th className="w-40 px-4 py-3 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-bold text-[#014171]">{item.name}</td><td className="px-4 py-3.5 tabular-nums text-slate-600">{item.unitCost > 0 ? peso.format(item.unitCost) : <span className="text-amber-600">Not set</span>}</td><td className="px-4 py-3.5 tabular-nums text-slate-700">{item.stock}</td><td className="px-4 py-3.5 tabular-nums text-slate-600">{item.threshold} / {item.criticalThreshold}</td><td className="px-4 py-3.5"><Badge color={item.showAlertCard ? "green" : "gray"}>{item.showAlertCard ? "Visible" : "Hidden"}</Badge></td><td className="px-4 py-3 text-right">{isAdmin && <div className="inline-flex items-center gap-2"><button type="button" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`} className="flex size-9 items-center justify-center rounded-lg text-[#014171] transition hover:bg-sky-50"><MorphIcon icon={Pencil} size={16} strokeWidth={2} reducedMotion="user" /></button><DeleteButton action={deleteAction} id={item.id} confirmText={`Delete toner type "${item.name}"? Its dashboard alert card will be removed.`} /></div>}</td></tr>)}
            {!filtered.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">No matching toner types.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="mt-3 shrink-0 text-xs font-medium text-slate-500">{filtered.length} of {items.length} toner types</p>

      <SystemDrawer open={adding} title="Add Toner Type" subtitle="Create a toner inventory record" onClose={() => setAdding(false)}>
        <form action={addAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2"><Input label="Toner type" name="name" required floatingLabel /><Input label="Unit cost (PHP)" name="unitCost" type="number" min="0" step="0.01" required floatingLabel /></div>
          <div className="mt-5 flex justify-end gap-2"><SecondaryButton type="button" onClick={() => setAdding(false)}>Cancel</SecondaryButton><PrimaryButton type="submit">Add toner type</PrimaryButton></div>
        </form>
      </SystemDrawer>

      {editing && <SystemDrawer open title="Edit Toner Type" subtitle={editing.name} onClose={() => setEditing(null)} width="max-w-2xl">
        <div className="space-y-4">
          <form action={updateAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="id" value={editing.id} />
            <h3 className="mb-4 text-sm font-bold text-slate-800">Toner details</h3>
            <div className="grid gap-4 sm:grid-cols-2"><Input label="Toner type" name="name" defaultValue={editing.name} required floatingLabel /><Input label="Unit cost (PHP)" name="unitCost" type="number" min="0" step="0.01" defaultValue={editing.unitCost.toFixed(2)} required floatingLabel /></div>
            <div className="mt-5 flex justify-end"><PrimaryButton type="submit">Save details</PrimaryButton></div>
          </form>
          <form action={thresholdAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="tonerTypeId" value={editing.id} />
            <h3 className="mb-1 text-sm font-bold text-slate-800">Inventory thresholds</h3><p className="mb-4 text-xs text-slate-500">Critical must not exceed the low-stock threshold.</p>
            <div className="grid gap-4 sm:grid-cols-2"><Input label="Low-stock threshold" name="threshold" type="number" min="0" defaultValue={editing.threshold} required floatingLabel /><Input label="Critical threshold" name="criticalThreshold" type="number" min="0" defaultValue={editing.criticalThreshold} required floatingLabel /></div>
            <div className="mt-5 flex justify-end"><PrimaryButton type="submit">Update thresholds</PrimaryButton></div>
          </form>
          <form action={visibilityAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <input type="hidden" name="tonerTypeId" value={editing.id} />
            <label className="flex items-center gap-3 text-sm font-semibold text-slate-700"><input type="checkbox" name="showAlertCard" defaultChecked={editing.showAlertCard} className="size-4 rounded border-slate-300 text-[#014171]" /><MorphIcon icon={BellRing} size={16} strokeWidth={2} reducedMotion="user" />Show dashboard alert cards</label>
            <div className="mt-5 flex justify-end"><PrimaryButton type="submit">Save visibility</PrimaryButton></div>
          </form>
        </div>
      </SystemDrawer>}
    </div>
  );
}
