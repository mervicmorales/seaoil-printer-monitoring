export const USER_ROLES = ["super_admin", "admin", "support", "employee"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  support: "Support",
  employee: "Employee",
};

export function isUserRole(role: string): role is UserRole {
  return USER_ROLES.includes(role as UserRole);
}

export function hasAdminPrivileges(role: string) {
  return role === "super_admin" || role === "admin";
}

export function isSuperAdmin(role: string) {
  return role === "super_admin";
}

export function canManageRole(actorRole: UserRole, targetRole: string) {
  if (!isUserRole(targetRole)) return false;
  if (actorRole === "super_admin") return true;
  if (actorRole === "admin") return targetRole === "support" || targetRole === "employee";
  return false;
}

export function roleLabel(role: string) {
  return isUserRole(role) ? ROLE_LABELS[role] : role;
}
