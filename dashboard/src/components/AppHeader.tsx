"use client";

import NotificationBell from "@/components/NotificationBell";

type HeaderNotification = {
  id: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export default function AppHeader({
  notifications,
  hideNotifications = false,
}: {
  notifications: HeaderNotification[];
  hideNotifications?: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between gap-4 border-b border-slate-200/80 bg-white/50 px-4 py-3 shadow-[0_1px_8px_rgba(15,23,42,0.025)] backdrop-blur-md sm:px-8">
      <div id="app-page-header-slot" className="min-w-0 flex-1" />

      {!hideNotifications && (
        <div className="shrink-0">
          <NotificationBell notifications={notifications} />
        </div>
      )}
    </header>
  );
}
