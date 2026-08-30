import type { ReactNode } from "react";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function ContractsLayout({ children }: { children: ReactNode }) {
  await requireModuleFullAccess("contract");
  return children;
}
