import { isSuperAdmin, type UserRole } from "@/lib/roles";

export const MODULES = [
  "dashboard",
  "printers",
  "toner",
  "contract",
  "repair",
  "printops",
  "system",
  "manage_users",
  "registrations",
] as const;

export type ModuleName = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleName, string> = {
  dashboard: "PrintOps",
  printers: "Printers",
  toner: "Toner Monitoring",
  contract: "Contract",
  repair: "Printer Repair History",
  printops: "Printer Services",
  system: "System",
  manage_users: "Manage Users",
  registrations: "Registrations",
};

export const MODULE_PATHS: Record<ModuleName, string> = {
  dashboard: "/dashboard",
  printers: "/printers",
  toner: "/toner-monitoring",
  contract: "/contracts",
  repair: "/repair-history",
  printops: "/printops/print",
  system: "/system",
  manage_users: "/manage",
  registrations: "/manage/registrations",
};

export function emptyModuleAccess(): Record<ModuleName, boolean> {
  return Object.fromEntries(MODULES.map((module) => [module, false])) as Record<
    ModuleName,
    boolean
  >;
}

// Default module access granted to a newly created support account.
export const DEFAULT_SUPPORT_ACCESS: Record<ModuleName, boolean> = {
  dashboard: false,
  printers: false,
  toner: true,
  contract: false,
  repair: false,
  printops: false,
  system: false,
  manage_users: false,
  registrations: false,
};

export function defaultAccessForRole(role: UserRole) {
  if (isSuperAdmin(role) || role === "admin") {
    return MODULES.reduce(
      (acc, m) => ({ ...acc, [m]: true }),
      {} as Record<ModuleName, boolean>,
    );
  }
  return role === "employee" ? emptyModuleAccess() : { ...DEFAULT_SUPPORT_ACCESS };
}
