import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { systemSettings, users } from "@/db/schema";
import Sidebar from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";
import { BlobSkinProvider } from "@/components/BlobSkinProvider";
import { getBlobSkinCookieName, isBlobSkin } from "@/lib/blob-skins";
import { emptyModuleAccess } from "@/lib/permissions";
import { requireSession } from "@/lib/server-utils";

export default async function EmployeePortalLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  if (session.role !== "employee") redirect("/dashboard");

  const cookieStore = await cookies();
  const collapsedCookie = cookieStore.get("seaoil-sidebar-collapsed")?.value;
  const blobSkinCookie = cookieStore.get(getBlobSkinCookieName(String(session.id)))?.value;
  const [settingsRows, userRows] = await Promise.all([
    db.select({ logoUrl: systemSettings.logoUrl }).from(systemSettings).limit(1),
    db.select({ fullName: users.fullName }).from(users).where(eq(users.id, session.id)).limit(1),
  ]);
  const accountName = (userRows[0]?.fullName || session.fullName || "SEAOIL Employee")
    .trim()
    .replace(/\s+/g, " ");

  return (
    <BlobSkinProvider
      accountId={String(session.id)}
      initialSkin={isBlobSkin(blobSkinCookie) ? blobSkinCookie : "violet"}
    >
      <div className="flex min-h-screen bg-[#f4f6f9]">
        <Sidebar
          logoUrl={settingsRows[0]?.logoUrl ?? null}
          accountName={accountName || "SEAOIL Employee"}
          initialCollapsed={collapsedCookie === undefined ? null : collapsedCookie === "true"}
          moduleAccess={emptyModuleAccess()}
          employeeMode
        />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-0">
          <AppHeader notifications={[]} hideNotifications />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
        </div>
      </div>
    </BlobSkinProvider>
  );
}
