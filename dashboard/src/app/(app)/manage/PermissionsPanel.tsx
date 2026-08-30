"use client";

import { useState } from "react";
import { SecondaryButton } from "@/components/ui";
import { MODULES, MODULE_LABELS } from "@/lib/permissions";

export default function PermissionsPanel({
  userId,
  role,
  access,
  action,
}: {
  userId: number;
  role: string;
  access: Record<string, boolean>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setOpen((v) => !v)} className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium hover:bg-slate-50">
        {open ? "Hide Permissions" : "Permissions"}
      </button>
      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
          {role === "admin" ? (
            <p className="text-xs text-slate-500">Admins always have full access to every module.</p>
          ) : role === "employee" ? (
            <p className="text-xs text-slate-500">
              Employees use the Employee Portal and can only see active printers assigned to their location and department.
            </p>
          ) : (
            <form action={action} className="space-y-3">
              <input type="hidden" name="userId" value={userId} />
              <p className="text-xs text-slate-500">
                Checked modules grant access to the page and its actions. Unchecked modules are hidden and access is denied.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {MODULES.map((m) => (
                  <label key={m} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name={`module_${m}`} defaultChecked={access[m]} />
                    {MODULE_LABELS[m]}
                  </label>
                ))}
              </div>
              <SecondaryButton type="submit" className="text-xs">Save Permissions</SecondaryButton>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
