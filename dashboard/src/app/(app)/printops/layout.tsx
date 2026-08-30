import type { ReactNode } from "react";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function PrintOpsLayout({ children }: { children: ReactNode }) {
  await requireModuleFullAccess("printops");
  return children;
}
