import type { ReactNode } from "react";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function PrintersLayout({ children }: { children: ReactNode }) {
  await requireModuleFullAccess("printers");
  return children;
}
