"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Activity, BellRing, ChevronDown, ExternalLink, Printer, ServerCog } from "lucide";
import { Badge, IconGlyph } from "@/components/ui";

export type AgentPrinterStatus = "online" | "offline" | "warning" | "unread";

export type AgentOperationsPrinter = {
  id: number;
  department: string;
  serialNumber: string;
  office: string;
  status: AgentPrinterStatus;
  activeAlerts: number;
  statusDetail?: string;
};

export type AgentOperationsAgent = {
  id: number;
  name: string;
  office: string;
  online: boolean;
  lastSeenLabel: string;
  printers: AgentOperationsPrinter[];
};

export default function AgentOperationsPanel({ agents }: { agents: AgentOperationsAgent[] }) {
  const sortedAgents = [...agents].sort((left, right) => Number(right.online) - Number(left.online) || left.name.localeCompare(right.name));
  const [selectedAgentId, setSelectedAgentId] = useState<number | null>(sortedAgents[0]?.id ?? null);
  const [highlightedStatus, setHighlightedStatus] = useState<AgentPrinterStatus | null>(null);
  const selectedAgent = sortedAgents.find((agent) => agent.id === selectedAgentId) ?? sortedAgents[0] ?? null;
  const selectedPrinters = selectedAgent?.printers ?? [];
  const groups = groupPrintersByOffice(selectedPrinters);
  const onlineAgents = agents.filter((agent) => agent.online).length;
  const offlineAgents = agents.length - onlineAgents;
  const activeAlerts = selectedPrinters.reduce((sum, printer) => sum + printer.activeAlerts, 0);

  return (
    <section aria-labelledby="agent-operations-heading" className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
      <div className="flex min-h-[4.25rem] flex-col justify-between gap-3 border-t-2 border-t-[#7c3aed] border-b border-slate-200 px-4 py-2.5 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="shrink-0 text-[#014171]"><IconGlyph icon={Activity} size={16} /></span>
          <div className="min-w-0">
            <h2 id="agent-operations-heading" className="truncate text-sm font-bold text-slate-800">Agent &amp; Printer Status</h2>
            <p className="truncate text-[11px] text-slate-500">{onlineAgents} agents online · {offlineAgents} offline · Select an agent to inspect its printers</p>
          </div>
        </div>
        <Link href="/printers" className="inline-flex shrink-0 items-center gap-1 text-[10px] font-bold text-[#0b70a8] hover:text-[#014171]">
          View details <IconGlyph icon={ExternalLink} size={10} />
        </Link>
      </div>

      <div className="grid min-h-0 flex-1 md:grid-cols-[15rem_minmax(0,1fr)]">
        <div className="min-h-0 border-b border-slate-200 bg-slate-50/60 md:border-r md:border-b-0">
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Agent offices</p>
            <Link
              href="/monitoring-agents"
              aria-label={`View ${agents.length} monitoring ${agents.length === 1 ? "agent" : "agents"}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-bold text-[#0b70a8] transition-colors hover:bg-sky-50 hover:text-[#014171] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#014171]"
            >
              {agents.length} {agents.length === 1 ? "agent" : "agents"}
              <IconGlyph icon={ExternalLink} size={9} />
            </Link>
          </div>
          <div className="max-h-44 divide-y divide-slate-200 overflow-y-auto md:h-[calc(100%_-_2.1rem)] md:max-h-none">
            {sortedAgents.length ? sortedAgents.map((agent) => {
              const selected = selectedAgent?.id === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => {
                    setSelectedAgentId(agent.id);
                    setHighlightedStatus(null);
                  }}
                  className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition ${selected ? "bg-white shadow-[inset_3px_0_0_#014171]" : "hover:bg-white/80"}`}
                >
                  <span className={`mt-1 size-2 shrink-0 rounded-full ${agent.online ? "bg-emerald-500" : "bg-rose-500"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[13px] font-bold ${selected ? "text-[#014171]" : "text-slate-800"}`}>{agent.name}</span>
                    <span className="mt-0.5 block truncate text-[10px] text-slate-500">{agent.office}</span>
                    <span className="mt-1 flex items-center justify-between gap-2 text-[10px] text-slate-400"><span>{agent.printers.length} printers</span><span>{agent.lastSeenLabel}</span></span>
                  </span>
                </button>
              );
            }) : <EmptyState>No monitoring agents are available.</EmptyState>}
          </div>
        </div>

        <div className="flex min-h-0 flex-col">
          {selectedAgent ? (
            <>
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-slate-800">{selectedAgent.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">{selectedAgent.office} · {selectedPrinters.length} connected printers</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {activeAlerts > 0 && <span className="inline-flex items-center gap-1 text-[10px] font-bold text-violet-700"><IconGlyph icon={BellRing} size={10} />{activeAlerts} alerts</span>}
                    <Badge color={selectedAgent.online ? "green" : "red"}>{selectedAgent.online ? "Online" : "Offline"}</Badge>
                  </div>
                </div>
                <PrinterHealthBar
                  printers={selectedPrinters}
                  highlightedStatus={highlightedStatus}
                  onHighlightStatus={setHighlightedStatus}
                />
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
                {groups.length ? groups.map((group) => (
                  <OfficePrinterGroup
                    key={group.office}
                    group={group}
                    highlightedStatus={highlightedStatus}
                    onHighlightStatus={setHighlightedStatus}
                  />
                )) : <EmptyState>No printers are assigned to this agent.</EmptyState>}
              </div>
            </>
          ) : <EmptyState>Select a monitoring agent to view its connected printers.</EmptyState>}
        </div>
      </div>
    </section>
  );
}

type OfficeGroup = { office: string; printers: AgentOperationsPrinter[] };

function OfficePrinterGroup({
  group,
  highlightedStatus,
  onHighlightStatus,
}: {
  group: OfficeGroup;
  highlightedStatus: AgentPrinterStatus | null;
  onHighlightStatus: (status: AgentPrinterStatus | null) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const printerListId = useId();
  const alerts = group.printers.reduce((sum, printer) => sum + printer.activeAlerts, 0);

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200">
      <div className="bg-slate-50 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={printerListId}
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#014171]"
        >
          <div className="flex min-w-0 items-center gap-2 text-[#014171]">
            <IconGlyph icon={ServerCog} size={13} />
            <h3 className="truncate text-xs font-bold text-slate-800">{group.office}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2 text-[10px] font-semibold text-slate-500">
            <span>{group.printers.length} printers</span>
            {alerts > 0 && <span className="inline-flex items-center gap-1 text-violet-700"><IconGlyph icon={BellRing} size={10} />{alerts} alerts</span>}
            <span className={`text-slate-400 transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : "rotate-0"}`}><IconGlyph icon={ChevronDown} size={13} /></span>
          </div>
        </button>
        <PrinterHealthBar
          printers={group.printers}
          compact
          highlightedStatus={highlightedStatus}
          onHighlightStatus={onHighlightStatus}
        />
      </div>
      <div id={printerListId} hidden={!expanded} className="grid divide-y divide-slate-100 lg:grid-cols-2 lg:divide-y-0">
        {group.printers.map((printer, index) => {
          return (
            <div
              key={printer.id}
              className={`flex min-w-0 items-center justify-between gap-3 px-3 py-2 transition-all duration-150 motion-reduce:transition-none ${index > 1 ? "lg:border-t lg:border-slate-100" : ""} ${index % 2 === 0 ? "lg:border-r lg:border-slate-100" : ""} ${printerHighlightClass(printer.status, highlightedStatus)}`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-sky-50 text-[#014171]"><IconGlyph icon={Printer} size={13} /></span>
                <span className="min-w-0"><span className="block truncate text-[11px] font-bold text-slate-800">{printer.department}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{printer.serialNumber}{printer.statusDetail ? ` · ${printer.statusDetail}` : ""}</span></span>
              </span>
              <span className="flex shrink-0 items-center gap-2"><PrinterStatus status={printer.status} />{printer.activeAlerts > 0 && <span className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-700"><IconGlyph icon={BellRing} size={10} />{printer.activeAlerts}</span>}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

const healthStatuses: Array<{
  status: AgentPrinterStatus;
  label: string;
  shortLabel: string;
  barClass: string;
  dotClass: string;
}> = [
  { status: "online", label: "Healthy", shortLabel: "healthy", barClass: "bg-emerald-500", dotClass: "bg-emerald-500" },
  { status: "warning", label: "Warning", shortLabel: "warning", barClass: "bg-amber-400", dotClass: "bg-amber-400" },
  { status: "offline", label: "Offline", shortLabel: "offline", barClass: "bg-rose-500", dotClass: "bg-rose-500" },
  { status: "unread", label: "No reading", shortLabel: "no reading", barClass: "bg-slate-400", dotClass: "bg-slate-400" },
];

function PrinterHealthBar({
  printers,
  compact = false,
  highlightedStatus,
  onHighlightStatus,
}: {
  printers: AgentOperationsPrinter[];
  compact?: boolean;
  highlightedStatus: AgentPrinterStatus | null;
  onHighlightStatus: (status: AgentPrinterStatus | null) => void;
}) {
  const segments = healthStatuses.map((item) => ({
    ...item,
    count: printers.filter((printer) => printer.status === item.status).length,
  }));

  if (!printers.length) return <div className={`${compact ? "mt-2 h-1.5" : "mt-3 h-2.5"} rounded-full bg-slate-200`} />;

  return (
    <div className={compact ? "mt-2" : "mt-3"}>
      <div className={`flex w-full gap-1 overflow-hidden rounded-full bg-slate-100 ${compact ? "h-1.5" : "h-2.5"}`} aria-label={`${printers.length} printers by current status`}>
        {segments.filter((segment) => segment.count > 0).map((segment) => (
          <button
            key={segment.status}
            type="button"
            aria-label={`Highlight ${segment.count} ${segment.shortLabel} printers`}
            title={`${segment.label}: ${segment.count}`}
            onMouseEnter={() => onHighlightStatus(segment.status)}
            onMouseLeave={() => onHighlightStatus(null)}
            onFocus={() => onHighlightStatus(segment.status)}
            onBlur={() => onHighlightStatus(null)}
            className={`${segment.barClass} min-w-1 transition-opacity duration-150 motion-reduce:transition-none ${highlightedStatus && highlightedStatus !== segment.status ? "opacity-20" : "opacity-100"}`}
            style={{ flexBasis: 0, flexGrow: segment.count }}
          />
        ))}
      </div>
      <div className={`flex flex-wrap items-center ${compact ? "mt-1.5 gap-x-3 gap-y-1" : "mt-2 gap-1.5"}`}>
        {segments.map((segment) => (
          <button
            key={segment.status}
            type="button"
            aria-pressed={highlightedStatus === segment.status}
            onMouseEnter={() => onHighlightStatus(segment.status)}
            onMouseLeave={() => onHighlightStatus(null)}
            onFocus={() => onHighlightStatus(segment.status)}
            onBlur={() => onHighlightStatus(null)}
            className={`inline-flex items-center transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#014171] motion-reduce:transition-none ${segment.count === 0 ? "opacity-55" : ""} ${highlightedStatus && highlightedStatus !== segment.status ? "opacity-35" : ""} ${highlightedStatus === segment.status ? "text-slate-900" : ""} ${compact ? "gap-1 rounded px-0.5 text-[9px] font-semibold text-slate-500" : `gap-1.5 rounded-full border bg-white px-2 py-1 text-[10px] font-bold text-slate-600 ${highlightedStatus === segment.status ? "border-slate-400 shadow-sm" : "border-slate-200"}`}`}
          >
            <span className={`size-1.5 rounded-full ${segment.dotClass}`} />
            <span className="tabular-nums">{segment.count}</span> {compact ? segment.shortLabel : segment.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PrinterStatus({ status }: { status: AgentPrinterStatus }) {
  const styles: Record<AgentPrinterStatus, string> = { online: "bg-emerald-50 text-emerald-700", offline: "bg-rose-50 text-rose-700", warning: "bg-amber-50 text-amber-700", unread: "bg-slate-100 text-slate-500" };
  const labels: Record<AgentPrinterStatus, string> = { online: "Online", offline: "Offline", warning: "Warning", unread: "No reading" };
  return <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.04em] ${styles[status]}`}>{labels[status]}</span>;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-24 items-center justify-center px-5 text-center text-xs text-slate-500">{children}</div>;
}

function groupPrintersByOffice(printers: AgentOperationsPrinter[]): OfficeGroup[] {
  const groups = new Map<string, AgentOperationsPrinter[]>();
  for (const printer of printers) groups.set(printer.office, [...(groups.get(printer.office) ?? []), printer]);
  return [...groups.entries()]
    .map(([office, officePrinters]) => ({ office, printers: officePrinters.sort((left, right) => statusRank(left.status) - statusRank(right.status) || left.department.localeCompare(right.department)) }))
    .sort((left, right) => left.office.localeCompare(right.office));
}

function statusRank(status: AgentPrinterStatus) {
  return status === "offline" ? 0 : status === "warning" ? 1 : status === "unread" ? 2 : 3;
}

function printerHighlightClass(status: AgentPrinterStatus, highlightedStatus: AgentPrinterStatus | null) {
  if (!highlightedStatus) return "bg-white";
  if (status !== highlightedStatus) return "bg-white opacity-30";
  const backgrounds: Record<AgentPrinterStatus, string> = {
    online: "bg-emerald-50/80 shadow-[inset_3px_0_0_#10b981]",
    warning: "bg-amber-50/90 shadow-[inset_3px_0_0_#f59e0b]",
    offline: "bg-rose-50/80 shadow-[inset_3px_0_0_#f43f5e]",
    unread: "bg-slate-100 shadow-[inset_3px_0_0_#94a3b8]",
  };
  return backgrounds[status];
}
