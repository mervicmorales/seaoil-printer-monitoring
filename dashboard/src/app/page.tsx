import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getModuleAccessMap } from "@/lib/server-utils";
import { MODULES, MODULE_PATHS } from "@/lib/permissions";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "employee") redirect("/portal");
  if (session.role === "admin") redirect("/dashboard");
  const access = await getModuleAccessMap(session.id, session.role);
  const firstModule = MODULES.find((module) => access[module]);
  redirect(firstModule ? MODULE_PATHS[firstModule] : "/access-denied");
}
