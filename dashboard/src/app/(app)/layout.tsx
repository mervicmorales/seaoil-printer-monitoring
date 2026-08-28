import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import { db } from "@/db";
import { notifications, systemSettings, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Sidebar from "@/components/Sidebar";
import AppHeader from "@/components/AppHeader";
import AgentStatusNotifications from "@/components/AgentStatusNotifications";
import { PageHeaderPlacement } from "@/components/PageHeaderPortal";
import { getBlobSkinCookieName, isBlobSkin } from "@/lib/blob-skins";
import { BlobSkinProvider } from "@/components/BlobSkinProvider";

export default async function AppLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal?: ReactNode;
}) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const cookieStore = await cookies();
  const collapsedCookie = cookieStore.get("seaoil-sidebar-collapsed")?.value;
  const blobSkinCookie = cookieStore.get(getBlobSkinCookieName(String(session.id)))?.value;
  const [recentNotifications, settingsRows, userRows] = await Promise.all([
    db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(20),
    db
      .select({ logoUrl: systemSettings.logoUrl })
      .from(systemSettings)
      .limit(1),
    db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, session.id))
      .limit(1),
  ]);
  const accountName = (userRows[0]?.fullName || session.fullName || "SEAOIL User")
    .trim()
    .replace(/\s+/g, " ");

  return (
    <BlobSkinProvider
      accountId={String(session.id)}
      initialSkin={isBlobSkin(blobSkinCookie) ? blobSkinCookie : "violet"}
    >
      <div className="flex min-h-screen bg-[#f4f6f9]">
        <AgentStatusNotifications />
        <Sidebar
          isAdmin={session.role === "admin"}
          canManageSpot={access.spot}
          logoUrl={settingsRows[0]?.logoUrl ?? null}
          accountName={accountName || "SEAOIL User"}
          initialCollapsed={
            collapsedCookie === undefined ? null : collapsedCookie === "true"
          }
        />
        <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:pl-0">
          <AppHeader
            notifications={recentNotifications.map((n) => ({
              ...n,
              createdAt: n.createdAt.toISOString(),
            }))}
          />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-8">{children}</main>
        </div>
        <PageHeaderPlacement inAppHeader={false}>{modal}</PageHeaderPlacement>
      </div>
    </BlobSkinProvider>
  );
}
