"use client";

import { useEffect } from "react";
import { gooeyToast } from "goey-toast";

export type LoginStatusNotice = {
  tone: "success" | "info" | "error";
  title: string;
  message: string;
};

export default function LoginStatusToasts({ notice }: { notice: LoginStatusNotice | null }) {
  useEffect(() => {
    if (!notice) return;
    gooeyToast[notice.tone](notice.title, {
      id: `login-status-${notice.tone}-${notice.title}`,
      description: notice.message,
    });
  }, [notice]);

  return null;
}
