"use client";

import { useEffect } from "react";
import { notifyActionError, notifyActionSuccess } from "@/lib/toast-notifications";

export default function SuccessBanner({
  message,
  errorMessage,
  showInline = true,
}: {
  message?: string;
  errorMessage?: string;
  showInline?: boolean;
}) {
  useEffect(() => {
    if (message) notifyActionSuccess(message);
  }, [message]);

  useEffect(() => {
    if (errorMessage) notifyActionError(errorMessage);
  }, [errorMessage]);

  if ((!message && !errorMessage) || !showInline) return null;
  if (errorMessage) {
    return (
      <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {errorMessage}
      </div>
    );
  }
  return (
    <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
      ✓ {message}
    </div>
  );
}
