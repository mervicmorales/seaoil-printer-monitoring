"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { gooeyToast } from "goey-toast";

const STORAGE_KEY = "seaoil-monitoring-agent-status-v1";
const CHECK_INTERVAL_MS = 60_000;

type AgentStatus = {
  id: number;
  name: string;
  hostname: string | null;
  reachable: boolean;
  lastSeen: string | null;
};

type AgentStatusResponse = {
  success: boolean;
  agents?: AgentStatus[];
  newlyOfflineIds?: number[];
};

export default function AgentStatusNotifications() {
  const router = useRouter();

  const checkAgentStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/monitoring/agent-status", {
        method: "POST",
        cache: "no-store",
      });
      if (!response.ok) return;

      const data = await response.json() as AgentStatusResponse;
      if (!data.success || !data.agents) return;

      let previous: Record<string, boolean> = {};
      try {
        previous = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "{}");
      } catch {
        previous = {};
      }

      const newlyOffline = new Set(data.newlyOfflineIds ?? []);
      let sawStatusTransition = newlyOffline.size > 0;
      for (const agent of data.agents) {
        const priorReachable = previous[String(agent.id)];
        const label = agent.hostname ? `${agent.name} · ${agent.hostname}` : agent.name;

        if (!agent.reachable && (newlyOffline.has(agent.id) || priorReachable === true)) {
          sawStatusTransition = true;
          gooeyToast.error("Monitoring agent unreachable", {
            id: `monitoring-agent-${agent.id}-connectivity`,
            description: `${label} stopped checking in. Printer data from this agent may be stale.`,
          });
        } else if (agent.reachable && priorReachable === false) {
          sawStatusTransition = true;
          gooeyToast.success("Monitoring agent recovered", {
            id: `monitoring-agent-${agent.id}-connectivity`,
            description: `${label} is checking in again.`,
          });
        }
      }

      const next = Object.fromEntries(
        data.agents.map((agent) => [String(agent.id), agent.reachable]),
      );
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Agent status toasts remain best-effort when browser storage is unavailable.
      }

      if (sawStatusTransition) router.refresh();
    } catch {
      // A failed dashboard request is not proof that an office agent is offline.
    }
  }, [router]);

  useEffect(() => {
    void checkAgentStatus();
    const timer = window.setInterval(() => void checkAgentStatus(), CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [checkAgentStatus]);

  return null;
}
