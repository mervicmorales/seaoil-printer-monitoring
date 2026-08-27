"use client";

import { useEffect } from "react";
import { notifyActionSuccess } from "@/lib/toast-notifications";

export default function SuccessBanner({
  message,
  showInline = true,
}: {
  message?: string;
  showInline?: boolean;
}) {
  useEffect(() => {
    if (message) notifyActionSuccess(message);
  }, [message]);

  if (!message || !showInline) return null;
  return (
    <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      ✓ {message}
    </div>
  );
}
