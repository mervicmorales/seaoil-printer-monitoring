import Link from "next/link";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import {
  Activity,
  CircleCheckBig,
  Clock3,
  Eye,
  Plus,
  Printer,
  Radar,
  TriangleAlert,
  type IconNode,
} from "lucide";
import { db } from "@/db";
import {
  monitoringAgents,
  printerDiscoveryScans,
  printers,
  type DiscoveredPrinter,
} from "@/db/schema";
import { Badge, Card, IconGlyph, PageHeader, TableCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { requireModuleFullAccess } from "@/lib/server-utils";
import { printerDetailHref } from "@/lib/printer-navigation";
import { queueDiscoveryScanAction } from "./actions";
import DiscoveryScanToasts from "./DiscoveryScanToasts";
import SearchableDropdown from "@/components/SearchableDropdown";

export const dynamic = "force-dynamic";

export default async function DiscoverPrintersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireModuleFullAccess("discover_printers");
  const params = await searchParams;
  const renderedAt = new Date();
  const [agents, scans, registeredPrinters] = await Promise.all([
    db
      .select({
        id: monitoringAgents.id,
        name: monitoringAgents.name,
        hostname: monitoringAgents.hostname,
        status: monitoringAgents.status,
        lastSeen: monitoringAgents.lastSeen,
      })
      .from(monitoringAgents)
      .where(and(isNotNull(monitoringAgents.tokenHash), isNull(monitoringAgents.tokenRevokedAt)))
      .orderBy(monitoringAgents.name),
    db
      .select({
        id: printerDiscoveryScans.id,
        agentId: printerDiscoveryScans.agentId,
        agentName: monitoringAgents.name,
        subnet: printerDiscoveryScans.subnet,
        status: printerDiscoveryScans.status,
        results: printerDiscoveryScans.results,
        errorMessage: printerDiscoveryScans.errorMessage,
        requestedAt: printerDiscoveryScans.requestedAt,
      })
      .from(printerDiscoveryScans)
      .innerJoin(monitoringAgents, eq(printerDiscoveryScans.agentId, monitoringAgents.id))
      .orderBy(desc(printerDiscoveryScans.requestedAt), desc(printerDiscoveryScans.id))
      .limit(10),
    db.select({ id: printers.id, ipAddress: printers.ipAddress }).from(printers),
  ]);

  const latestScan = scans[0];
  const results = Array.isArray(latestScan?.results)
    ? latestScan.results as DiscoveredPrinter[]
    : [];
  const registeredByIp = new Map(
    registeredPrinters
      .filter((printer): printer is { id: number; ipAddress: string } => Boolean(printer.ipAddress))
      .map((printer) => [printer.ipAddress, printer.id]),
  );
  const defaultSubnet = "172.16.0.0/24";

  return (
    <div>
      <DiscoveryScanToasts
        successMessage={params.success}
        errorMessage={params.error}
        scans={scans.map((scan) => ({
          id: scan.id,
          agentName: scan.agentName,
          subnet: scan.subnet,
          status: scan.status,
          resultCount: Array.isArray(scan.results) ? scan.results.length : 0,
          errorMessage: scan.errorMessage,
        }))}
      />
      <PageHeader
        title="Discover Printers"
        subtitle="Scan an office network through an authenticated PrintDash agent."
        actions={
          <RefreshControl
            refreshedAtLabel={formatDateTime(renderedAt)}
            intervalSeconds={10}
            iconOnly
          />
        }
      />

      <Card className="mb-6 overflow-hidden">
        <div className="flex flex-col justify-between gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
              <IconGlyph icon={Radar} size={19} />
            </span>
            <div>
              <h2 className="font-bold text-[#014171]">Scan network</h2>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
                Select an office agent and the IPv4 /24 subnet it should inspect using its configured SNMP community.
              </p>
            </div>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
            <IconGlyph icon={Activity} size={13} />
            254 addresses per scan
          </span>
        </div>
        {agents.length === 0 ? (
          <div className="m-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 sm:m-6">
            <span className="mt-0.5 shrink-0 text-amber-600"><IconGlyph icon={TriangleAlert} size={17} /></span>
            <div>
              <p className="font-semibold">No active monitoring agent</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-700">A monitoring agent with an active credential is required before a network scan can be requested.</p>
            </div>
          </div>
        ) : (
          <form action={queueDiscoveryScanAction} className="grid grid-cols-1 gap-4 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-start">
            <SearchableDropdown
              label="Monitoring agent"
              name="agentId"
              required
              placeholder="Search monitoring agents..."
              defaultValue={agents[0] ? String(agents[0].id) : ""}
              options={agents.map((agent) => ({ value: String(agent.id), label: `${agent.name}${agent.hostname ? ` · ${agent.hostname}` : ""}${agent.status !== "online" ? " · inactive" : ""}` }))}
            />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Subnet (CIDR)</span>
              <input
                name="subnet"
                defaultValue={defaultSubnet}
                placeholder="172.16.0.0/24"
                maxLength={18}
                required
                aria-describedby="subnet-format-help"
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 font-mono text-sm text-slate-700 shadow-sm outline-none transition placeholder:font-sans placeholder:text-slate-400 hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15"
              />
              <span id="subnet-format-help" className="mt-1.5 block text-xs text-slate-500">
                Exact format: 172.16.x.0/24. For example, 172.16.8.0/24 scans 172.16.8.1–172.16.8.254.
              </span>
            </label>
            <button type="submit" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md active:translate-y-px lg:mt-[1.625rem]">
              <IconGlyph icon={Radar} size={16} />
              Discover Printers
            </button>
          </form>
        )}
      </Card>

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Network discovery</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Latest scan results</h2>
          {latestScan && (
            <p className="mt-1.5 text-xs text-slate-500">
              {latestScan.agentName} · {latestScan.subnet} · requested {formatDateTime(latestScan.requestedAt)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {latestScan && <ScanStatus status={latestScan.status} count={results.length} />}
          {latestScan?.status === "completed" && (
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
              {results.length} results
            </span>
          )}
        </div>
      </div>

      <TableCard className="overscroll-contain">
        {!latestScan ? (
          <EmptyResults
            icon={Radar}
            title="No discovery scan yet"
            message="Configure an office agent and subnet above to discover SNMP-enabled printers."
          />
        ) : latestScan.status === "queued" || latestScan.status === "running" ? (
          <EmptyResults
            icon={Activity}
            title={latestScan.status === "queued" ? "Scan queued" : "Scanning network"}
            message={latestScan.status === "queued" ? "Waiting for the selected agent to claim the scan…" : "The agent is scanning the network…"}
            tone="blue"
          />
        ) : latestScan.status === "failed" ? (
          <EmptyResults
            icon={TriangleAlert}
            title="Discovery scan failed"
            message={latestScan.errorMessage || "The network scan failed."}
            tone="red"
          />
        ) : results.length === 0 ? (
          <EmptyResults
            icon={Printer}
            title="No printers discovered"
            message="No SNMP-enabled printers responded on this subnet."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100 lg:hidden">
              {results.map((printer) => {
                const registeredId = registeredByIp.get(printer.ip);
                const addHref = buildAddPrinterHref(printer, latestScan.agentId);
                return (
                  <DiscoveredPrinterCard
                    key={printer.ip}
                    printer={printer}
                    registeredId={registeredId}
                    addHref={addHref}
                  />
                );
              })}
            </div>

            <div className="hidden lg:block">
              <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                <thead className="bg-slate-50/95 text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  <tr>
                    <th className="w-[17%] whitespace-nowrap px-4 py-3">IP Address</th>
                    <th className="w-[19%] whitespace-nowrap px-4 py-3">Serial Number</th>
                    <th className="w-[39%] whitespace-nowrap px-4 py-3">Model / Description</th>
                    <th className="w-[25%] whitespace-nowrap px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((printer) => {
                    const registeredId = registeredByIp.get(printer.ip);
                    const addHref = buildAddPrinterHref(printer, latestScan.agentId);
                    return (
                      <tr key={printer.ip} className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-4 font-mono text-xs font-bold text-[#014171]">{printer.ip}</td>
                        <td className="px-4 py-4 font-mono text-xs font-medium text-slate-700">{printer.serialNumber || "—"}</td>
                        <td className="px-4 py-4">
                          <p className="truncate font-semibold text-slate-800" title={printer.model || printer.description}>{printer.model || printer.description || "—"}</p>
                          {printer.model && printer.description !== printer.model && <p className="mt-1 truncate text-xs text-slate-500" title={printer.description}>{printer.description}</p>}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <PrinterResultAction
                            registeredId={registeredId}
                            addHref={addHref}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </TableCard>
    </div>
  );
}

function buildAddPrinterHref(printer: DiscoveredPrinter, agentId: number) {
  const params = new URLSearchParams({
    ip: printer.ip,
    macAddress: printer.macAddress ?? "",
    serial: printer.serialNumber ?? "",
    model: printer.model ?? "",
    monitoringAgentId: String(agentId),
    returnTo: "/printdash/discover",
  });
  return `/printers/new?${params.toString()}`;
}

function ScanStatus({ status, count }: { status: string; count: number }) {
  const color = status === "completed" ? "green" : status === "failed" ? "red" : status === "running" ? "blue" : "yellow";
  const label = status === "completed" ? `${count} found` : status === "running" ? "Scanning" : status === "queued" ? "Queued" : "Failed";
  return <Badge color={color}>{label}</Badge>;
}

function DiscoveredPrinterCard({
  printer,
  registeredId,
  addHref,
}: {
  printer: DiscoveredPrinter;
  registeredId: number | undefined;
  addHref: string;
}) {
  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={Printer} size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800" title={printer.model || printer.description}>
              {printer.model || printer.description || "Unknown printer"}
            </p>
            <p className="mt-1 font-mono text-xs font-bold text-[#014171]">{printer.ip}</p>
          </div>
        </div>
        <Badge color={registeredId ? "green" : "blue"}>
          {registeredId ? "Registered" : "Discovered"}
        </Badge>
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Serial number</dt>
          <dd className="mt-1 break-all font-mono text-xs font-semibold text-slate-700">{printer.serialNumber || "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Description</dt>
          <dd className="mt-1 break-words text-xs font-medium leading-5 text-slate-700">{printer.description || "—"}</dd>
        </div>
      </dl>

      <div className="mt-4">
        <PrinterResultAction registeredId={registeredId} addHref={addHref} fullWidth />
      </div>
    </article>
  );
}

function PrinterResultAction({
  registeredId,
  addHref,
  fullWidth = false,
}: {
  registeredId: number | undefined;
  addHref: string;
  fullWidth?: boolean;
}) {
  if (registeredId) {
    return (
      <Link
        href={printerDetailHref(registeredId, "/printdash/discover")}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 ${fullWidth ? "w-full" : ""}`}
      >
        <IconGlyph icon={Eye} size={14} />
        View Registered Printer
      </Link>
    );
  }

  return (
    <Link
      href={addHref}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#014171] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md ${fullWidth ? "w-full" : ""}`}
    >
      <IconGlyph icon={Plus} size={14} />
      Add Printer
    </Link>
  );
}

function EmptyResults({
  icon,
  title,
  message,
  tone = "slate",
}: {
  icon: IconNode;
  title: string;
  message: string;
  tone?: "slate" | "blue" | "red";
}) {
  const iconClass = tone === "blue"
    ? "bg-sky-50 text-sky-600"
    : tone === "red"
      ? "bg-red-50 text-red-600"
      : "bg-slate-100 text-slate-400";

  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
      <span className={`flex size-12 items-center justify-center rounded-2xl ${iconClass}`}>
        <IconGlyph icon={icon} size={22} />
      </span>
      <p className="mt-4 text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 max-w-md text-xs leading-5 text-slate-500">{message}</p>
    </div>
  );
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
}
