export const MODULES = [
  "dashboard",
  "printers",
  "toner",
  "contract",
  "repair",
  "system",
] as const;

export type ModuleName = (typeof MODULES)[number];

export const MODULE_LABELS: Record<ModuleName, string> = {
  dashboard: "Dashboard",
  printers: "Printers",
  toner: "Toner Monitoring",
  contract: "Contract",
  repair: "Repair History",
  system: "System",
};

// Default module access granted to a newly created "user" role account.
export const DEFAULT_USER_ACCESS: Record<ModuleName, boolean> = {
  dashboard: false,
  printers: false,
  toner: true,
  contract: false,
  repair: false,
  system: false,
};

export function defaultAccessForRole(role: "admin" | "user") {
  if (role === "admin") {
    return MODULES.reduce(
      (acc, m) => ({ ...acc, [m]: true }),
      {} as Record<ModuleName, boolean>,
    );
  }
  return { ...DEFAULT_USER_ACCESS };
}
