import type { ReactNode } from "react";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  await requireModuleFullAccess("dashboard");
  return children;
}
