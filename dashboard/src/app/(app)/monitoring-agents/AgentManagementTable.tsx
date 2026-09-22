"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Eye, PackageCheck, RefreshCw, Server, Wifi, WifiOff } from "lucide";
import { Badge, EmptyState, IconGlyph, PageHeader, StatCard, TableCard } from "@/components/ui";
import type { AgentSummary } from "@/lib/agent-management";
import Search from "@/components/Search";
import RecordTableToolbar from "@/components/RecordTableToolbar";
import PrinterColumnFilter, { type PrinterColumnFilterOption } from "@/app/(app)/printers/PrinterColumnFilter";

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
  const [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  const agentFilters = searchParams.getAll("agent");
  const statusFilters = searchParams.getAll("status");
  const sort = searchParams.get("sort") ?? "";

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
  const agentOptions = useMemo(() => uniqueFilterOptions(agents.map((agent) => ({
    value: agent.name,
    label: agent.name,
  }))), [agents]);
  const statusOptions = useMemo(() => uniqueFilterOptions(agents.map((agent) => ({
    value: agent.connectivity,
    label: agent.connectivity === "online" ? "Online" : "Offline",
  }))), [agents]);
  const filteredAgents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return agents
      .filter((agent) => (
        (!normalized || [
          agent.name,
          agent.location,
          agent.hostname,
          agent.platformLabel,
          agent.installedVersion,
        ].some((value) => value?.toLocaleLowerCase().includes(normalized)))
        && (agentFilters.length === 0 || agentFilters.includes(agent.name))
        && (statusFilters.length === 0 || statusFilters.includes(agent.connectivity))
      ))
      .sort((left, right) => {
        if (sort === "agent_asc") return left.name.localeCompare(right.name, undefined, { numeric: true });
        if (sort === "agent_desc") return right.name.localeCompare(left.name, undefined, { numeric: true });
        if (sort === "status_asc") return left.connectivity.localeCompare(right.connectivity);
        if (sort === "status_desc") return right.connectivity.localeCompare(left.connectivity);
        return 0;
      });
  }, [agentFilters, agents, query, sort, statusFilters]);

  return (
    <div className="flex h-[calc(100dvh-103px)] min-h-0 flex-col overflow-hidden sm:h-[calc(100dvh-111px)]">
      <PageHeader
        parentTitle="Printers"
        title="Monitoring Agents"
        actions={
          <div className="flex items-center gap-3">
            <span suppressHydrationWarning className="hidden text-xs text-slate-500 sm:inline">
              Updated {formatRelativeTime(generatedAt)}
            </span>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label={refreshing ? "Refreshing monitoring agents" : "Refresh monitoring agents"}
              className="inline-flex size-9 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
            >
              <IconGlyph icon={RefreshCw} size={15} />
            </button>
          </div>
        }
      />

      <div className="mb-4 grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
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

      <TableCard className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <RecordTableToolbar count={filteredAgents.length} label="agent">
          <Search
            value={query}
            onValueChange={setQuery}
            placeholder="Search agents"
            ariaLabel="Search monitoring agents"
          />
        </RecordTableToolbar>
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        {filteredAgents.length === 0 ? (
          <EmptyState message={query ? "No agents found" : "No monitoring agents registered"} />
        ) : (
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[20%]" />
              <col className="w-[20%]" />
              <col className="w-[14%]" />
              <col className="w-[6%]" />
            </colgroup>
            <thead className="bg-slate-50/95 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Location / Agent">
                    <PrinterColumnFilter label="Agent" paramName="agent" options={agentOptions} selectedValues={agentFilters} currentSort={sort} sortAscValue="agent_asc" sortDescValue="agent_desc" />
                  </FilterableHeading>
                </th>
                <th className="px-4 py-2.5">
                  <FilterableHeading label="Status">
                    <PrinterColumnFilter label="Status" paramName="status" options={statusOptions} selectedValues={statusFilters} currentSort={sort} sortAscValue="status_asc" sortDescValue="status_desc" />
                  </FilterableHeading>
                </th>
                <th className="px-4 py-3">Version / Update</th>
                <th className="px-4 py-3">Platform / Hostname</th>
                <th className="px-4 py-3">Last Seen</th>
                <th className="px-3 py-3"><span className="sr-only">View</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAgents.map((agent) => (
                <tr key={agent.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-3 align-top">
                    <p className="font-semibold text-slate-800">{agent.location || "Unassigned location"}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{agent.name} · {agent.assignedPrinterCount} printer{agent.assignedPrinterCount === 1 ? "" : "s"}</p>
                  </td>
                  <td className="px-4 py-3 align-top"><ConnectivityBadge status={agent.connectivity} /></td>
                  <td className="px-4 py-3 align-top">
                    <p className="truncate font-mono text-xs font-semibold text-slate-700" title={agent.installedVersion || "Unknown"}>{agent.installedVersion || "Unknown"}</p>
                    <p className="mt-1 truncate font-mono text-[10px] text-slate-400" title={`Latest ${agent.latestVersion}`}>Latest {agent.latestVersion}</p>
                    <div className="mt-1.5"><UpdateBadge status={agent.updateStatus} /></div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="truncate text-slate-700" title={agent.platformLabel}>{agent.platformLabel}</p>
                    <p className="mt-0.5 truncate font-mono text-xs text-slate-500" title={agent.hostname || "Unknown hostname"}>{agent.hostname || "Unknown hostname"}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-400">{agent.architecture || "Unknown architecture"}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700" title={formatDateTime(agent.lastSeen)}><time suppressHydrationWarning>{formatRelativeTime(agent.lastSeen)}</time></td>
                  <td className="px-3 py-3 text-right align-top">
                    <Link href={`/monitoring-agents/${agent.id}`} aria-label={`View ${agent.name}`} className="inline-flex size-8 items-center justify-center rounded-md text-[#014171] transition hover:bg-slate-100">
                      <IconGlyph icon={Eye} size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        </div>
      </TableCard>
    </div>
  );
}

function FilterableHeading({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <span className="min-w-0 leading-4">{label}</span>
      {children}
    </div>
  );
}

function uniqueFilterOptions(options: PrinterColumnFilterOption[]) {
  return [...new Map(options.map((option) => [option.value, option])).values()]
    .sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }));
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
