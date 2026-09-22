import type { ReactNode } from "react";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function OverviewLayout({ children }: { children: ReactNode }) {
  await requireModuleFullAccess("dashboard");
  return children;
}
