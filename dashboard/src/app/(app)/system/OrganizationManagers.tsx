"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Pencil, Plus, Search } from "lucide";
import { MorphIcon } from "morphicons/react";
import DeleteButton from "@/components/DeleteButton";
import { Badge, Input, PrimaryButton, SecondaryButton } from "@/components/ui";
import SearchableDropdown from "@/components/SearchableDropdown";
import SystemDrawer from "./SystemDrawer";

type Action = (formData: FormData) => void | Promise<void>;
type Department = { id: number; name: string; status: string };
type Location = { id: number; name: string; address: string | null; status: string };
type Subunit = { id: number; name: string; departmentId: number; departmentName: string; status: string };
type CostCenter = { id: number; code: string; status: string };
type Mapping = { id: number; locationId: number; locationName: string; departmentName: string; subunitId: number; subunitName: string; costCenterId: number; costCenterCode: string; status: string };

export function LocationsManager({ items, addAction, updateAction, deleteAction, readOnly }: { items: Location[]; addAction: Action; updateAction: Action; deleteAction: Action; readOnly: boolean }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.address ?? ""} ${item.status}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <ManagerShell title="Offices" description="Office addresses and active status are maintained centrally." count={filtered.length} total={items.length} query={query} onQuery={setQuery} addLabel="Add Office" onAdd={readOnly ? undefined : () => setAdding(true)}>
    <DataTable headings={["Office", "Address", "Status", "Actions"]} empty={!filtered.length}>
      {filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-semibold text-slate-800">{item.name}</td><td className="px-4 py-3.5 text-slate-600">{item.address || "—"}</td><td className="px-4 py-3.5"><StatusBadge status={item.status} /></td><ActionCell readOnly={readOnly} onEdit={() => setEditing(item)} deleteAction={deleteAction} id={item.id} confirmText={`Delete ${item.name}? Referenced offices must be deactivated instead.`} /></tr>)}
    </DataTable>
    <SystemDrawer open={adding} title="Add Office" subtitle="Create an office record" onClose={() => setAdding(false)}><LocationForm action={addAction} onCancel={() => setAdding(false)} /></SystemDrawer>
    {editing && <SystemDrawer open title="Edit Office" subtitle={editing.name} onClose={() => setEditing(null)}><LocationForm action={updateAction} item={editing} onCancel={() => setEditing(null)} /></SystemDrawer>}
  </ManagerShell>;
}

function LocationForm({ action, item, onCancel }: { action: Action; item?: Location; onCancel: () => void }) {
  return <PanelForm action={action} onCancel={onCancel} submitLabel={item ? "Save changes" : "Add office"}>{item && <input type="hidden" name="id" value={item.id} />}<div className="space-y-4"><Input label="Office name" name="name" defaultValue={item?.name ?? ""} required floatingLabel /><Input label="Address" name="address" defaultValue={item?.address ?? ""} floatingLabel />{item && <StatusField value={item.status} />}</div></PanelForm>;
}

export function DepartmentsManager({ items, addAction, updateAction, deleteAction, readOnly }: { items: Department[]; addAction: Action; updateAction: Action; deleteAction: Action; readOnly: boolean }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.status}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <ManagerShell title="Departments" description="Departments own sub-units and remain available to historical records when inactive." count={filtered.length} total={items.length} query={query} onQuery={setQuery} addLabel="Add Department" onAdd={readOnly ? undefined : () => setAdding(true)}>
    <DataTable headings={["Department", "Status", "Actions"]} empty={!filtered.length}>
      {filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-semibold text-slate-800">{item.name}</td><td className="px-4 py-3.5"><StatusBadge status={item.status} /></td><ActionCell readOnly={readOnly} onEdit={() => setEditing(item)} deleteAction={deleteAction} id={item.id} confirmText={`Delete ${item.name}? Referenced departments must be deactivated instead.`} /></tr>)}
    </DataTable>
    <SystemDrawer open={adding} title="Add Department" subtitle="Create an organizational department" onClose={() => setAdding(false)}><DepartmentForm action={addAction} onCancel={() => setAdding(false)} /></SystemDrawer>
    {editing && <SystemDrawer open title="Edit Department" subtitle={editing.name} onClose={() => setEditing(null)}><DepartmentForm action={updateAction} item={editing} onCancel={() => setEditing(null)} /></SystemDrawer>}
  </ManagerShell>;
}

function DepartmentForm({ action, item, onCancel }: { action: Action; item?: Department; onCancel: () => void }) {
  return <PanelForm action={action} onCancel={onCancel} submitLabel={item ? "Save changes" : "Add department"}>{item && <input type="hidden" name="id" value={item.id} />}<div className="space-y-4"><Input label="Department name" name="name" defaultValue={item?.name ?? ""} required floatingLabel />{item && <StatusField value={item.status} />}</div></PanelForm>;
}

export function SubunitsManager({ items, departments, addAction, updateAction, deleteAction, readOnly }: { items: Subunit[]; departments: Department[]; addAction: Action; updateAction: Action; deleteAction: Action; readOnly: boolean }) {
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Subunit | null>(null);
  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.departmentName} ${item.status}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  return <ManagerShell title="Sub-units" description="Each sub-unit belongs to one department." count={filtered.length} total={items.length} query={query} onQuery={setQuery} addLabel="Add Sub-unit" onAdd={readOnly ? undefined : () => setAdding(true)}>
    <DataTable headings={["Sub-unit", "Department", "Status", "Actions"]} empty={!filtered.length}>
      {filtered.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-semibold text-slate-800">{item.name}</td><td className="px-4 py-3.5 text-slate-600">{item.departmentName}</td><td className="px-4 py-3.5"><StatusBadge status={item.status} /></td><ActionCell readOnly={readOnly} onEdit={() => setEditing(item)} deleteAction={deleteAction} id={item.id} confirmText={`Delete ${item.name}? Referenced sub-units must be deactivated instead.`} /></tr>)}
    </DataTable>
    <SystemDrawer open={adding} title="Add Sub-unit" subtitle="Assign a sub-unit to a department" onClose={() => setAdding(false)}><SubunitForm action={addAction} departments={departments} onCancel={() => setAdding(false)} /></SystemDrawer>
    {editing && <SystemDrawer open title="Edit Sub-unit" subtitle={editing.name} onClose={() => setEditing(null)}><SubunitForm action={updateAction} departments={departments} item={editing} onCancel={() => setEditing(null)} /></SystemDrawer>}
  </ManagerShell>;
}

function SubunitForm({ action, departments, item, onCancel }: { action: Action; departments: Department[]; item?: Subunit; onCancel: () => void }) {
  return <PanelForm action={action} onCancel={onCancel} submitLabel={item ? "Save changes" : "Add sub-unit"}>{item && <input type="hidden" name="id" value={item.id} />}<div className="space-y-4"><SearchableDropdown label="Department" name="departmentId" defaultValue={item ? String(item.departmentId) : ""} placeholder="Search departments..." required options={departments.filter((department) => item || department.status === "active").map((department) => ({ value: String(department.id), label: department.name }))} /><Input label="Sub-unit name" name="name" defaultValue={item?.name ?? ""} required floatingLabel />{item && <StatusField value={item.status} />}</div></PanelForm>;
}

export function MappingsManager({ items, costCenters, locations, subunits, addAction, updateAction, deleteAction, updateCostCenterAction, deleteCostCenterAction, readOnly }: { items: Mapping[]; costCenters: CostCenter[]; locations: Location[]; subunits: Subunit[]; addAction: Action; updateAction: Action; deleteAction: Action; updateCostCenterAction: Action; deleteCostCenterAction: Action; readOnly: boolean }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"mappings" | "codes">("mappings");
  const [adding, setAdding] = useState(false);
  const [editingMapping, setEditingMapping] = useState<Mapping | null>(null);
  const [editingCode, setEditingCode] = useState<CostCenter | null>(null);
  const filteredMappings = useMemo(() => items.filter((item) => `${item.locationName} ${item.departmentName} ${item.subunitName} ${item.costCenterCode} ${item.status}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const filteredCodes = useMemo(() => costCenters.filter((item) => `${item.code} ${item.status}`.toLowerCase().includes(query.toLowerCase())), [costCenters, query]);
  const shown = view === "mappings" ? filteredMappings.length : filteredCodes.length;
  const total = view === "mappings" ? items.length : costCenters.length;
  return <ManagerShell title="Cost Centers" description="Maintain cost-center codes and the explicit office and sub-unit combinations where each code is valid." count={shown} total={total} query={query} onQuery={setQuery} addLabel="Add Mapping" onAdd={readOnly || view === "codes" ? undefined : () => setAdding(true)} beforeToolbar={<div className="inline-flex rounded-xl bg-slate-100 p-1"><button type="button" onClick={() => { setView("mappings"); setQuery(""); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "mappings" ? "bg-white text-[#014171] shadow-sm" : "text-slate-500"}`}>Mappings</button><button type="button" onClick={() => { setView("codes"); setQuery(""); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${view === "codes" ? "bg-white text-[#014171] shadow-sm" : "text-slate-500"}`}>Cost-center codes</button></div>}>
    {view === "mappings" ? <DataTable headings={["Office", "Department", "Sub-unit", "Cost Center", "Status", "Actions"]} empty={!filteredMappings.length}>
      {filteredMappings.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-semibold text-slate-800">{item.locationName}</td><td className="px-4 py-3.5 text-slate-600">{item.departmentName}</td><td className="px-4 py-3.5 text-slate-600">{item.subunitName}</td><td className="px-4 py-3.5 font-mono font-semibold text-[#014171]">{item.costCenterCode}</td><td className="px-4 py-3.5"><StatusBadge status={item.status} /></td><ActionCell readOnly={readOnly} onEdit={() => setEditingMapping(item)} deleteAction={deleteAction} id={item.id} confirmText="Delete this mapping? Referenced mappings must be deactivated instead." /></tr>)}
    </DataTable> : <DataTable headings={["Cost-center Code", "Status", "Actions"]} empty={!filteredCodes.length}>
      {filteredCodes.map((item) => <tr key={item.id} className="hover:bg-slate-50/70"><td className="px-4 py-3.5 font-mono font-semibold text-[#014171]">{item.code}</td><td className="px-4 py-3.5"><StatusBadge status={item.status} /></td><ActionCell readOnly={readOnly} onEdit={() => setEditingCode(item)} deleteAction={deleteCostCenterAction} id={item.id} confirmText={`Delete ${item.code}? Referenced cost centers must be deactivated instead.`} /></tr>)}
    </DataTable>}
    <SystemDrawer open={adding} title="Add Cost-center Mapping" subtitle="Create an allowed organization combination" onClose={() => setAdding(false)} width="max-w-2xl"><PanelForm action={addAction} onCancel={() => setAdding(false)} submitLabel="Add mapping"><div className="space-y-4"><SearchableDropdown label="Office" name="locationId" placeholder="Search offices..." required options={locations.filter((item) => item.status === "active").map((item) => ({ value: String(item.id), label: item.name }))} /><SearchableDropdown label="Department / Sub-unit" name="subunitId" placeholder="Search departments or sub-units..." required options={subunits.filter((item) => item.status === "active").map((item) => ({ value: String(item.id), label: `${item.departmentName} — ${item.name}` }))} /><Input label="Cost-center code" name="costCenter" required floatingLabel /></div></PanelForm></SystemDrawer>
    {editingMapping && <SystemDrawer open title="Edit Mapping" subtitle={`${editingMapping.locationName} · ${editingMapping.costCenterCode}`} onClose={() => setEditingMapping(null)}><PanelForm action={updateAction} onCancel={() => setEditingMapping(null)} submitLabel="Save changes"><input type="hidden" name="id" value={editingMapping.id} /><div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600"><p className="font-semibold text-slate-800">{editingMapping.locationName}</p><p className="mt-1">{editingMapping.departmentName} · {editingMapping.subunitName}</p><p className="mt-1 font-mono font-semibold text-[#014171]">{editingMapping.costCenterCode}</p></div><div className="mt-4"><StatusField value={editingMapping.status} /></div></PanelForm></SystemDrawer>}
    {editingCode && <SystemDrawer open title="Edit Cost-center Code" subtitle={editingCode.code} onClose={() => setEditingCode(null)}><PanelForm action={updateCostCenterAction} onCancel={() => setEditingCode(null)} submitLabel="Save changes"><input type="hidden" name="id" value={editingCode.id} /><div className="space-y-4"><Input label="Cost-center code" name="code" defaultValue={editingCode.code} required floatingLabel /><StatusField value={editingCode.status} /></div></PanelForm></SystemDrawer>}
  </ManagerShell>;
}

function ManagerShell({ title, description, count, total, query, onQuery, addLabel, onAdd, beforeToolbar, children }: { title: string; description: string; count: number; total: number; query: string; onQuery: (value: string) => void; addLabel: string; onAdd?: () => void; beforeToolbar?: ReactNode; children: ReactNode }) {
  const searchAndAction = <div className="flex min-w-0 items-center justify-end gap-2"><label className="relative min-w-0 flex-1 sm:w-52 sm:flex-none"><MorphIcon icon={Search} size={15} strokeWidth={2} reducedMotion="user" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search records" className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15" /></label>{onAdd && <PrimaryButton type="button" onClick={onAdd} className="h-10 shrink-0 whitespace-nowrap py-2"><MorphIcon icon={Plus} size={15} strokeWidth={2} reducedMotion="user" />{addLabel}</PrimaryButton>}</div>;
  return <div className="flex h-full min-h-0 flex-col">
    {beforeToolbar ? <>
      <div className="mb-3 shrink-0"><h2 className="text-sm font-bold text-[#014171]">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
      <div className="mb-4 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">{beforeToolbar}{searchAndAction}</div>
    </> : <div className="mb-4 flex shrink-0 flex-col gap-3 xl:flex-row xl:items-end xl:justify-between"><div><h2 className="text-sm font-bold text-[#014171]">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>{searchAndAction}</div>}
    <div className="min-h-0 flex-1 overflow-hidden">{children}</div><p className="mt-3 shrink-0 text-xs font-medium text-slate-500">{count} of {total} records</p>
  </div>;
}

function DataTable({ headings, empty, children }: { headings: string[]; empty: boolean; children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">
    <p className="mb-2 flex shrink-0 items-center gap-2 text-xs font-medium text-slate-500 lg:hidden"><span aria-hidden="true">↔</span> Swipe horizontally to view all columns. The first column stays visible.</p>
    <div className="relative min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-[inset_-14px_0_18px_-18px_rgba(15,23,42,0.45)]">
      <table className="min-w-full text-left text-sm [&_tbody_td:first-child]:sticky [&_tbody_td:first-child]:left-0 [&_tbody_td:first-child]:z-[1] [&_tbody_td:first-child]:bg-app-surface [&_thead_th:first-child]:sticky [&_thead_th:first-child]:left-0 [&_thead_th:first-child]:z-20 [&_thead_th:first-child]:bg-app-surface-subtle">
        <thead className="sticky top-0 z-10 border-b border-app-border bg-app-surface-subtle text-[11px] uppercase tracking-[0.08em] text-app-muted"><tr>{headings.map((heading, index) => <th key={heading} className={`whitespace-nowrap px-4 py-3 ${index === headings.length - 1 ? "w-40 text-right" : ""}`}>{heading}</th>)}</tr></thead>
        <tbody className="divide-y divide-slate-100">{children}{empty && <tr><td colSpan={headings.length} className="px-4 py-12 text-center text-sm text-slate-400">No matching records.</td></tr>}</tbody>
      </table>
    </div>
  </div>;
}

function ActionCell({ readOnly, onEdit, deleteAction, id, confirmText }: { readOnly: boolean; onEdit: () => void; deleteAction: Action; id: number; confirmText: string }) {
  return <td className="px-4 py-3 text-right">{!readOnly && <div className="inline-flex items-center gap-2"><button type="button" onClick={onEdit} aria-label="Edit record" title="Edit" className="flex size-9 items-center justify-center rounded-lg text-[#014171] transition hover:bg-sky-50"><MorphIcon icon={Pencil} size={16} strokeWidth={2} reducedMotion="user" /></button><DeleteButton action={deleteAction} id={id} label="Delete record" iconOnly confirmText={confirmText} className="size-9 rounded-lg border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100" /></div>}</td>;
}

function PanelForm({ action, onCancel, submitLabel, children }: { action: Action; onCancel: () => void; submitLabel: string; children: ReactNode }) {
  return <form action={action} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{children}<div className="mt-5 flex justify-end gap-2"><SecondaryButton type="button" onClick={onCancel}>Cancel</SecondaryButton><PrimaryButton type="submit">{submitLabel}</PrimaryButton></div></form>;
}

function StatusField({ value }: { value: string }) {
  return <SearchableDropdown label="Status" name="status" defaultValue={value} placeholder="Search statuses..." options={[{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />;
}

function StatusBadge({ status }: { status: string }) {
  return <Badge color={status === "active" ? "green" : "gray"}>{status === "active" ? "Active" : "Inactive"}</Badge>;
}
