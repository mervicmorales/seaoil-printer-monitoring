import type { ReactNode } from "react";
import { requireModuleFullAccess } from "@/lib/server-utils";

export default async function PrintDashLayout({ children }: { children: ReactNode }) {
  await requireModuleFullAccess("spot");
  return children;
}
