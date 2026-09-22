import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getModuleAccessMap } from "@/lib/server-utils";
import { MODULE_PATHS, NAVIGABLE_MODULES } from "@/lib/permissions";
import { hasAdminPrivileges } from "@/lib/roles";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "employee") redirect("/portal");
  if (hasAdminPrivileges(session.role)) redirect("/overview");
  const access = await getModuleAccessMap(session.id, session.role);
  const firstModule = NAVIGABLE_MODULES.find((module) => access[module]);
  redirect(firstModule ? MODULE_PATHS[firstModule] : "/access-denied");
}
