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

  return null;
}
