"use client";

import { SecondaryButton } from "@/components/ui";
import { MODULES, MODULE_LABELS } from "@/lib/permissions";
import { isSuperAdmin, type UserRole } from "@/lib/roles";

export default function PermissionsPanel({
  userId,
  role,
  access,
  action,
  actorRole,
}: {
  userId: number;
  role: string;
  access: Record<string, boolean>;
  action: (formData: FormData) => void | Promise<void>;
  actorRole: UserRole;
}) {
  return (
    <div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          {isSuperAdmin(role) ? (
            <p className="text-xs text-slate-500">Super Admins always have full access to every module.</p>
          ) : role === "employee" ? (
            <p className="text-xs text-slate-500">
              Employees use the Employee Portal. Department printers are automatic, and additional grants are configured below.
            </p>
          ) : role === "admin" && !isSuperAdmin(actorRole) ? (
            <p className="text-xs text-slate-500">Only a Super Admin can configure an Admin account&apos;s module permissions.</p>
          ) : (
            <form action={action} className="space-y-3">
              <input type="hidden" name="userId" value={userId} />
              <p className="text-xs text-slate-500">
                Checked modules grant access to the page and its actions. Unchecked modules are hidden and access is denied.
              </p>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {MODULES.map((m) => (
                  <label key={m} className="flex min-h-10 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300">
                    <input type="checkbox" name={`module_${m}`} defaultChecked={access[m]} className="size-4 rounded border-slate-300 text-[#014171] focus:ring-[#7DA8D0]" />
                    {MODULE_LABELS[m]}
                  </label>
                ))}
              </div>
              <SecondaryButton type="submit" className="text-xs">Save Permissions</SecondaryButton>
            </form>
          )}
        </div>
    </div>
  );
}
