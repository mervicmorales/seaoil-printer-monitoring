"use client";

import { PrimaryButton } from "@/components/ui";
import { useState } from "react";
import {
  MODULE_LABELS,
  PAGE_PERMISSION_ITEMS,
  type PermissionListItem,
  type ModuleName,
} from "@/lib/permissions";
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
  access: Record<ModuleName, boolean>;
  action: (formData: FormData) => void | Promise<void>;
  actorRole: UserRole;
}) {
  const [selectedAccess, setSelectedAccess] = useState<Record<ModuleName, boolean>>(() => ({ ...access }));

  function permissionCheckbox(module: ModuleName) {
    return (
      <input
        type="checkbox"
        name={`module_${module}`}
        checked={Boolean(selectedAccess[module])}
        onChange={(event) => {
          const checked = event.target.checked;
          setSelectedAccess((current) => ({ ...current, [module]: checked }));
        }}
        className="size-4 rounded border-slate-300 text-[#014171] focus:ring-[#7DA8D0]"
      />
    );
  }

  function permissionItem(item: PermissionListItem) {
    const hasChildren = Boolean(item.children?.length);
    const isExpanded = Boolean(selectedAccess[item.module]);
    const childColumns = item.module === "printers"
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : "sm:grid-cols-2";

    return (
      <div
        key={item.module}
        className={`overflow-hidden rounded-xl border bg-white transition ${
          isExpanded
            ? "border-[#7DA8D0]/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            : "border-slate-200 hover:border-slate-300"
        }`}
      >
        <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3.5 text-sm font-semibold text-slate-700 sm:px-4">
          {permissionCheckbox(item.module)}
          <span>{MODULE_LABELS[item.module]}</span>
          {hasChildren && (
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {item.children?.length} pages
            </span>
          )}
          {item.module === "printops" && (
            <span className="ml-auto text-[11px] font-normal text-slate-400">All service pages included</span>
          )}
        </label>

        {hasChildren && isExpanded && (
          <div className={`grid gap-2 border-t border-slate-100 bg-slate-50/80 p-2.5 sm:p-3 ${childColumns}`}>
            {item.children?.map((child) => (
              <label
                key={child}
                className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 shadow-[0_1px_1px_rgba(15,23,42,0.02)] transition hover:border-[#7DA8D0] hover:text-slate-800"
              >
                {permissionCheckbox(child)}
                {MODULE_LABELS[child]}
              </label>
            ))}
          </div>
        )}
      </div>
    );
  }

  const dashboardPermission = PAGE_PERMISSION_ITEMS.find((item) => item.module === "dashboard");
  const groupedPermissions = PAGE_PERMISSION_ITEMS.filter((item) => item.children?.length);
  const remainingPermissions = PAGE_PERMISSION_ITEMS.filter(
    (item) => item.module !== "dashboard" && !item.children?.length,
  );

  return (
    <div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
          {isSuperAdmin(role) ? (
            <p className="text-xs text-slate-500">Super Admins always have full access to every module.</p>
          ) : role === "employee" ? (
            <p className="text-xs text-slate-500">
              Employees use the Employee Portal. Department printers are automatic, and additional grants are configured below.
            </p>
          ) : role === "admin" && !isSuperAdmin(actorRole) ? (
            <p className="text-xs text-slate-500">Only a Super Admin can configure an Admin account&apos;s module permissions.</p>
          ) : (
            <form action={action} className="space-y-4">
              <input type="hidden" name="userId" value={userId} />
              <p className="text-sm text-slate-500">
                Select a module to grant access. Printer and toner pages can be controlled individually from their submenu lists.
              </p>

              <div className="space-y-2.5">
                {dashboardPermission && permissionItem(dashboardPermission)}
                {groupedPermissions.map(permissionItem)}

                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
                  {remainingPermissions.map(permissionItem)}
                </div>
              </div>

              <div className="flex justify-end border-t border-slate-200 pt-4">
                <PrimaryButton type="submit" className="min-w-36 text-xs">
                  Save Permissions
                </PrimaryButton>
              </div>
            </form>
          )}
        </div>
    </div>
  );
}
