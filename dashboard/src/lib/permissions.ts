import { isSuperAdmin, type UserRole } from "@/lib/roles";

export const MODULES = [
  "dashboard",
  "printers",
  "printer_records",
  "repair",
  "monitoring_alerts",
  "discover_printers",
  "toner",
  "toner_monitoring",
  "toner_expenses",
  "contract",
  "printops",
  "registrations",
  "manage_users",
  "system",
] as const;

export type ModuleName = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleName, string> = {
  dashboard: "Dashboard",
  printers: "Printers",
  printer_records: "Printer Records",
  repair: "Repair History",
  monitoring_alerts: "Monitoring Alerts",
  discover_printers: "Discover Printers",
  toner: "Toners",
  toner_monitoring: "Toner Monitoring",
  toner_expenses: "Toner Expenses",
  contract: "Contract",
  printops: "Printer Services",
  registrations: "Registrations",
  manage_users: "Manage Users",
  system: "System",
};

export const MODULE_PATHS: Record<ModuleName, string> = {
  dashboard: "/dashboard",
  printers: "/printers",
  printer_records: "/printers",
  repair: "/repair-history",
  monitoring_alerts: "/printdash/alerts",
  discover_printers: "/printdash/discover",
  toner: "/toner-monitoring",
  toner_monitoring: "/toner-monitoring",
  toner_expenses: "/toner-expenses",
  contract: "/contracts",
  printops: "/printops/print",
  registrations: "/manage/registrations",
  manage_users: "/manage",
  system: "/system",
};

export const NAVIGABLE_MODULES = [
  "dashboard",
  "printer_records",
  "repair",
  "monitoring_alerts",
  "discover_printers",
  "toner_monitoring",
  "toner_expenses",
  "contract",
  "printops",
  "registrations",
  "manage_users",
  "system",
] as const satisfies readonly ModuleName[];

export const MODULE_PARENTS: Partial<Record<ModuleName, ModuleName>> = {
  printer_records: "printers",
  repair: "printers",
  monitoring_alerts: "printers",
  discover_printers: "printers",
  toner_monitoring: "toner",
  toner_expenses: "toner",
};

export type PermissionListItem = {
  module: ModuleName;
  children?: readonly ModuleName[];
};

export const PAGE_PERMISSION_ITEMS: readonly PermissionListItem[] = [
  { module: "dashboard" },
  {
    module: "printers",
    children: ["printer_records", "repair", "monitoring_alerts", "discover_printers"],
  },
  {
    module: "toner",
    children: ["toner_monitoring", "toner_expenses"],
  },
  { module: "contract" },
  { module: "printops" },
  { module: "registrations" },
  { module: "manage_users" },
  { module: "system" },
];

const LEGACY_CHILD_DEFAULTS: Partial<Record<ModuleName, ModuleName>> = {
  printer_records: "printers",
  monitoring_alerts: "printers",
  discover_printers: "printers",
  toner_monitoring: "toner",
  toner_expenses: "toner",
};

export function isModuleName(value: string): value is ModuleName {
  return (MODULES as readonly string[]).includes(value);
}

export function emptyModuleAccess(): Record<ModuleName, boolean> {
  return Object.fromEntries(MODULES.map((module) => [module, false])) as Record<
    ModuleName,
    boolean
  >;
}

export function resolveModuleAccess(
  rows: readonly { module: string; fullAccess: boolean }[],
): Record<ModuleName, boolean> {
  const map = emptyModuleAccess();
  const explicitModules = new Set<ModuleName>();

  for (const row of rows) {
    if (!isModuleName(row.module)) continue;
    explicitModules.add(row.module);
    map[row.module] = row.fullAccess;
  }

  // Accounts created before submenu permissions existed retain their former
  // access until an administrator explicitly saves the expanded permission set.
  for (const [child, parent] of Object.entries(LEGACY_CHILD_DEFAULTS) as [ModuleName, ModuleName][]) {
    if (!explicitModules.has(child)) map[child] = map[parent];
  }

  // Preserve a previously granted standalone child permission (notably the
  // former Repair module) by making its new parent group visible.
  for (const [child, parent] of Object.entries(MODULE_PARENTS) as [ModuleName, ModuleName][]) {
    if (map[child]) map[parent] = true;
  }

  // A submenu can never be accessed when its parent permission is disabled.
  for (const [child, parent] of Object.entries(MODULE_PARENTS) as [ModuleName, ModuleName][]) {
    map[child] = map[parent] && map[child];
  }

  return map;
}

// Default module access granted to a newly created support account.
export const DEFAULT_SUPPORT_ACCESS: Record<ModuleName, boolean> = {
  dashboard: false,
  printers: false,
  printer_records: false,
  repair: false,
  monitoring_alerts: false,
  discover_printers: false,
  toner: true,
  toner_monitoring: true,
  toner_expenses: true,
  contract: false,
  printops: false,
  registrations: false,
  manage_users: false,
  system: false,
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
