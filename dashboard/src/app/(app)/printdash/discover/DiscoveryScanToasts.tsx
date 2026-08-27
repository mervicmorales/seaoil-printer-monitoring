"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { gooeyToast } from "goey-toast";

const STORAGE_KEY = "seaoil-discovery-scan-toast-state-v1";

export type DiscoveryScanToastSnapshot = {
  id: number;
  agentName: string;
  subnet: string;
  status: string;
  resultCount: number;
  errorMessage: string | null;
};

export default function DiscoveryScanToasts({
  scans,
  successMessage,
  errorMessage,
}: {
  scans: DiscoveryScanToastSnapshot[];
  successMessage?: string;
  errorMessage?: string;
}) {
  const router = useRouter();
  const handledActionMessage = useRef(false);

  useEffect(() => {
    if (handledActionMessage.current || (!successMessage && !errorMessage)) return;
    handledActionMessage.current = true;

    if (errorMessage) {
      gooeyToast.error("Discovery scan not queued", {
        id: "discovery-scan-action-error",
        description: errorMessage,
      });
    } else if (successMessage) {
      gooeyToast.success("Discovery scan queued", {
        id: "discovery-scan-action-success",
        description: successMessage,
      });
    }

    router.replace("/printdash/discover", { scroll: false });
  }, [errorMessage, router, successMessage]);

  useEffect(() => {
    let previous: Record<string, string> | null = null;
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      previous = stored ? JSON.parse(stored) : null;
    } catch {
      previous = null;
    }

    if (previous) {
      for (const scan of scans) {
        const priorStatus = previous[String(scan.id)];
        if (!priorStatus || priorStatus === scan.status) continue;

        const description = `${scan.agentName} · ${scan.subnet}`;
        if (scan.status === "running") {
          gooeyToast.info("Discovery scan started", {
            id: `discovery-scan-${scan.id}`,
            description,
          });
        } else if (scan.status === "completed") {
          gooeyToast.success("Discovery scan completed", {
            id: `discovery-scan-${scan.id}`,
            description: `${description} · ${scan.resultCount} printer${scan.resultCount === 1 ? "" : "s"} found`,
          });
        } else if (scan.status === "failed") {
          gooeyToast.error("Discovery scan failed", {
            id: `discovery-scan-${scan.id}`,
            description: scan.errorMessage
              ? `${description} · ${scan.errorMessage}`
              : description,
          });
        }
      }
    }

    const next = Object.fromEntries(scans.map((scan) => [String(scan.id), scan.status]));
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Scan notifications remain best-effort when browser storage is unavailable.
    }
  }, [scans]);

  return null;
}
