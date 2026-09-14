"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, PackageCheck, RefreshCw, Server, Wifi, WifiOff } from "lucide";
import { Badge, EmptyState, IconGlyph, PageHeader, StatCard, TableCard } from "@/components/ui";
import type { AgentSummary } from "@/lib/agent-management";

const REFRESH_INTERVAL_MS = 45_000;

export default function AgentManagementTable({
  initialAgents,
  initialGeneratedAt,
}: {
  initialAgents: AgentSummary[];
  initialGeneratedAt: string;
}) {
  const [agents, setAgents] = useState(initialAgents);
  const [generatedAt, setGeneratedAt] = useState(initialGeneratedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const response = await fetch("/api/admin/monitoring/agents", {
        cache: "no-store",
        signal,
      });
      const body = await response.json() as {
        success?: boolean;
        message?: string;
        generatedAt?: string;
        agents?: AgentSummary[];
      };
      if (!response.ok || !body.success || !body.agents) {
        throw new Error(body.message || "Unable to refresh monitoring agents");
      }
      setAgents(body.agents);
      setGeneratedAt(body.generatedAt || new Date().toISOString());
      setError(null);
    } catch (refreshError) {
      if (refreshError instanceof DOMException && refreshError.name === "AbortError") return;
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh monitoring agents");
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const interval = window.setInterval(() => void refresh(controller.signal), REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  const counts = useMemo(() => ({
    total: agents.length,
    online: agents.filter((agent) => agent.connectivity === "online").length,
    offline: agents.filter((agent) => agent.connectivity === "offline").length,
    updates: agents.filter((agent) => agent.updateStatus === "update-available").length,
  }), [agents]);

  return (
    <div>
      <PageHeader
        title="Monitoring Agents"
        subtitle="Runtime, connectivity, and version status for registered office agents."
        actions={
          <div className="flex items-center gap-3">
            <span suppressHydrationWarning className="hidden text-xs text-slate-500 sm:inline">
              Updated {formatRelativeTime(generatedAt)}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-[#014171] shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
            >
              <IconGlyph icon={RefreshCw} size={15} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Registered agents" value={counts.total} icon={Server} compact />
        <StatCard label="Online" value={counts.online} accent="#059669" icon={Wifi} compact />
        <StatCard label="Offline" value={counts.offline} accent="#dc2626" icon={WifiOff} compact />
        <StatCard label="Updates available" value={counts.updates} accent="#d97706" icon={PackageCheck} compact />
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}. Existing information remains visible.
        </div>
      )}

      <TableCard className="h-[calc(100dvh-18rem)] min-h-[24rem]">
        {agents.length === 0 ? (
          <EmptyState message="No monitoring agents have been registered." />
        ) : (
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Location / Agent</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Latest</th>
                <th className="px-4 py-3">Update</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Hostname</th>
                <th className="px-4 py-3">Last Seen</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.map((agent) => (
                <tr key={agent.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-3 align-top">
                    <p className="font-semibold text-slate-800">{agent.location || "Unassigned location"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{agent.name} · {agent.assignedPrinterCount} printer{agent.assignedPrinterCount === 1 ? "" : "s"}</p>
                  </td>
                  <td className="px-4 py-3 align-top"><ConnectivityBadge status={agent.connectivity} /></td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-slate-700">{agent.installedVersion || "Unknown"}</td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-slate-700">{agent.latestVersion}</td>
                  <td className="px-4 py-3 align-top"><UpdateBadge status={agent.updateStatus} /></td>
                  <td className="px-4 py-3 align-top">
                    <p className="text-slate-700">{agent.platformLabel}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{agent.architecture || "Unknown architecture"}</p>
                  </td>
                  <td className="px-4 py-3 align-top font-mono text-xs text-slate-700">{agent.hostname || "Unknown"}</td>
                  <td className="px-4 py-3 align-top text-slate-700" title={formatDateTime(agent.lastSeen)}><time suppressHydrationWarning>{formatRelativeTime(agent.lastSeen)}</time></td>
                  <td className="px-4 py-3 text-right align-top">
                    <Link href={`/monitoring-agents/${agent.id}`} className="inline-flex rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#014171] transition hover:bg-sky-100">View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
}

export function ConnectivityBadge({ status }: { status: AgentSummary["connectivity"] }) {
  return <Badge color={status === "online" ? "green" : "red"}>{status === "online" ? "Online" : "Offline"}</Badge>;
}

export function UpdateBadge({ status }: { status: AgentSummary["updateStatus"] }) {
  if (status === "up-to-date") return <Badge color="green">Up to date</Badge>;
  if (status === "update-available") return <Badge color="orange">Update available</Badge>;
  return <Badge color="gray">Unknown version</Badge>;
}

export function formatRelativeTime(value: string | null) {
  if (!value) return "Never";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Unknown";
  const seconds = Math.round((timestamp - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, "second");
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, "hour");
  return formatter.format(Math.round(hours / 24), "day");
}

export function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}
