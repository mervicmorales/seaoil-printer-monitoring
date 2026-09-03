"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { Bell } from "lucide";
import { MorphIcon } from "morphicons/react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/(app)/shell-actions";

type Notif = {
  id: number;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string | Date;
};

export default function NotificationBell({ notifications }: { notifications: Notif[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.isRead).length;

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#014171] shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        aria-label="Notifications"
      >
        <MorphIcon icon={Bell} size={18} strokeWidth={2} reducedMotion="user" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-sm font-semibold text-[#014171]">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => startTransition(() => markAllNotificationsReadAction())}
                className="text-xs font-medium text-[#014171] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-slate-400">No notifications yet.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => startTransition(() => markNotificationReadAction(n.id))}
                className={`block w-full rounded-lg px-3 py-2 text-left text-xs transition hover:bg-slate-50 ${
                  n.isRead ? "text-slate-500" : "bg-[#FFD15C]/15 text-slate-800"
                }`}
              >
                <p className="font-medium">{n.message}</p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {new Date(n.createdAt).toLocaleString("en-PH")}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
