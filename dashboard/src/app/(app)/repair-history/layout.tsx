import type { ReactNode } from "react";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function RepairHistoryLayout({ children }: { children: ReactNode }) {
  await requireModuleFullAccess("repair");
  return children;
}
