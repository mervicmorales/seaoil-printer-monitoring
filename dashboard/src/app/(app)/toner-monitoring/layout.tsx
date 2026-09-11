import type { ReactNode } from "react";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function TonerMonitoringLayout({ children }: { children: ReactNode }) {
  await requireModuleFullAccess("toner_monitoring");
  return children;
}
