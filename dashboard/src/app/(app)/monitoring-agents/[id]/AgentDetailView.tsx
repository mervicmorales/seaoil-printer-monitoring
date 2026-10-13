"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Clock3, Cpu, MapPin, Network, PackageCheck, Printer, RefreshCw, Server } from "lucide";
import { Card, IconGlyph, PageHeader, StatCard } from "@/components/ui";
import type { AgentDetail } from "@/lib/agent-management";
import { ConnectivityBadge, UpdateBadge, formatDateTime } from "../AgentManagementTable";

const REFRESH_INTERVAL_MS = 45_000;

export default function AgentDetailView({
  initialAgent,
  embedded = false,
}: {
  initialAgent: AgentDetail;
  embedded?: boolean;
}) {
  const [agent, setAgent] = useState(initialAgent);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/admin/monitoring/agents/${agent.id}`, {
        cache: "no-store",
        signal,
      });
      const body = await response.json() as { success?: boolean; message?: string; agent?: AgentDetail };
      if (!response.ok || !body.success || !body.agent) throw new Error(body.message || "Unable to refresh agent details");
      setAgent(body.agent);
      setError(null);
    } catch (refreshError) {
      if (refreshError instanceof DOMException && refreshError.name === "AbortError") return;
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh agent details");
    } finally {
      if (!signal?.aborted) setRefreshing(false);
    }
  }, [agent.id]);

  useEffect(() => {
    const controller = new AbortController();
    const interval = window.setInterval(() => void refresh(controller.signal), REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  return (
    <div className={embedded ? "flex h-full min-h-0 flex-col" : ""}>
      <PageHeader
        parentTitle="Printers"
        title={agent.name}
        subtitle="Monitoring agent identity, runtime, connectivity, and latest upload details."
        actions={
          <div className="flex gap-2">
            {!embedded && <Link href="/monitoring-agents" className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"><IconGlyph icon={ArrowLeft} size={15} />Back</Link>}
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing monitoring agent" : "Refresh monitoring agent"}
              className={embedded
                ? "inline-flex size-9 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                : "inline-flex h-10 items-center gap-2 rounded-xl bg-[#014171] px-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] disabled:cursor-wait disabled:opacity-60"}
            >
              <IconGlyph icon={RefreshCw} size={15} />
              {!embedded && (refreshing ? "Refreshing…" : "Refresh")}
            </button>
          </div>
        }
      />

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}. Existing information remains visible.</div>}

      <div className={`grid shrink-0 grid-cols-2 lg:grid-cols-4 ${embedded ? "mb-3 gap-2" : "mb-5 gap-3"}`}>
        <StatCard label="Connectivity" value={<ConnectivityBadge agent={agent} />} accent={!agent.lastSeen ? "#d97706" : agent.connectivity === "online" ? "#059669" : "#dc2626"} icon={Network} compact />
        <StatCard label="Installed version" value={<span className="font-mono text-xl">{agent.installedVersion || "Unknown"}</span>} icon={Server} compact />
        <StatCard label="Update status" value={<UpdateBadge status={agent.updateStatus} />} accent={agent.updateStatus === "update-available" ? "#d97706" : "#059669"} icon={PackageCheck} compact />
        <StatCard label="Assigned printers" value={agent.assignedPrinterCount} icon={Printer} compact />
      </div>

      <div className={`grid ${embedded ? "min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-3" : "gap-5 xl:grid-cols-2"}`}>
        <DetailSection compact={embedded} icon={Server} title="Agent identity" description="Registered identity and the offices served by this agent.">
          <DetailField label="Agent name" value={agent.name} />
          <DetailField label="Agent key" value={agent.agentKey} mono />
          <DetailField label="Primary office" value={agent.location || "Not assigned"} />
          <DetailField label="Assigned offices" value={agent.assignedLocations.length ? agent.assignedLocations.join(", ") : "None"} wide />
        </DetailSection>

        <DetailSection compact={embedded} icon={Cpu} title="Runtime information" description="Non-sensitive application and host details reported by the agent.">
          <DetailField label="Operating system" value={agent.platformLabel} />
          <DetailField label="Platform value" value={agent.platform || "Unknown"} mono />
          <DetailField label="CPU architecture" value={agent.architecture || "Unknown"} mono />
          <DetailField label="Hostname" value={agent.hostname || "Unknown"} mono />
          <DetailField label="Node.js version" value={agent.nodeVersion || "Unknown"} mono />
          <DetailField label="Build identifier" value={agent.buildIdentifier || "Not reported"} mono />
        </DetailSection>

        <DetailSection compact={embedded} icon={Clock3} title="Communication" description="Latest heartbeat and successful monitoring upload received by the dashboard.">
          <DetailField label="Last seen" value={formatDateTime(agent.lastSeen)} wide />
          <DetailField label="Last successful upload" value={formatDateTime(agent.lastSuccessfulUploadAt)} wide />
          <DetailField label="Current uptime" value={formatUptime(agent.agentUptimeSeconds)} />
          <DetailField label="Latest supported version" value={agent.latestVersion} mono />
        </DetailSection>

        <DetailSection compact={embedded} icon={MapPin} title="Printer matching" description="Assignment totals and results from the most recent successful upload.">
          <DetailField label="Assigned printers" value={String(agent.assignedPrinterCount)} />
          <DetailField label="Matched printers" value={countLabel(agent.matchedPrinterCount)} />
          <DetailField label="Unmatched printers" value={countLabel(agent.unmatchedPrinterCount)} />
        </DetailSection>
      </div>
    </div>
  );
}

function DetailSection({ icon, title, description, children, compact = false }: { icon: typeof Server; title: string; description: string; children: React.ReactNode; compact?: boolean }) {
  return (
    <Card className={`flex min-h-0 flex-col overflow-hidden ${compact ? "h-full" : ""}`}>
      <div className={`flex shrink-0 items-start border-b border-slate-200 bg-slate-50/60 ${compact ? "gap-2.5 px-3 py-2.5" : "gap-3 px-5 py-4"}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171] ${compact ? "size-8" : "size-10"}`}><IconGlyph icon={icon} size={compact ? 15 : 18} /></span>
        <div className="min-w-0"><h2 className={`${compact ? "text-sm" : ""} truncate font-bold text-[#014171]`}>{title}</h2><p className={`${compact ? "line-clamp-2 text-xs leading-4" : "mt-0.5 text-xs leading-5"} text-slate-500`}>{description}</p></div>
      </div>
      <dl className={`grid min-h-0 flex-1 content-start ${compact ? "grid-cols-2 gap-x-3 gap-y-2 overflow-hidden p-3 [&_dt]:text-[9px] [&_dd]:mt-0.5 [&_dd]:line-clamp-2 [&_dd]:text-xs" : "gap-4 p-5 sm:grid-cols-2"}`}>{children}</dl>
    </Card>
  );
}

function DetailField({ label, value, mono = false, wide = false }: { label: string; value: string; mono?: boolean; wide?: boolean }) {
  return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</dt><dd className={`mt-1 break-words text-sm font-semibold text-slate-800 ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}

function countLabel(value: number | null) {
  return value === null ? "Not reported" : String(value);
}

function formatUptime(seconds: number | null) {
  if (seconds === null) return "Not reported";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`].filter(Boolean).join(" ");
}
