"use client";

import { useEffect } from "react";
import { gooeyToast } from "goey-toast";

export default function PrintOpsFeedback({
  success,
  error,
}: {
  success?: string;
  error?: string;
}) {
  useEffect(() => {
    if (success) {
      gooeyToast.success("PrintOps", {
        id: `printops-success-${success}`,
        description: success,
      });
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      gooeyToast.error("PrintOps action failed", {
        id: `printops-error-${error}`,
        description: error,
      });
    }
  }, [error]);

  if (!success && !error) return null;
  return (
    <div
      className={`mb-5 rounded-lg border px-4 py-3 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? success}
    </div>
  );
}
