import Link from "next/link";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  monitoringAgents,
  printerDiscoveryScans,
  printers,
  type DiscoveredPrinter,
} from "@/db/schema";
import { Badge, Card, PageHeader, TableCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { requireAdmin } from "@/lib/server-utils";
import { printerDetailHref } from "@/lib/printer-navigation";
import { queueDiscoveryScanAction } from "./actions";
import DiscoveryScanToasts from "./DiscoveryScanToasts";

export const dynamic = "force-dynamic";

export default async function DiscoverPrintersPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdmin();
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
          />
        }
      />

      <Card className="mb-6 p-5">
        <h2 className="font-semibold text-[#014171]">Scan Network</h2>
        <p className="mt-1 text-sm text-slate-500">
          The selected office agent scans all 254 addresses in the IPv4 /24 subnet using its configured SNMP community.
        </p>
        {agents.length === 0 ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No monitoring agent with an active credential is available.
          </p>
        ) : (
          <form action={queueDiscoveryScanAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Monitoring Agent</span>
              <select name="agentId" required className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm">
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}{agent.hostname ? ` · ${agent.hostname}` : ""}{agent.status !== "online" ? " · inactive" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Subnet (CIDR)</span>
              <input
                name="subnet"
                defaultValue={defaultSubnet}
                placeholder="172.16.0.0/24"
                maxLength={18}
                required
                aria-describedby="subnet-format-help"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm"
              />
              <span id="subnet-format-help" className="mt-1.5 block text-xs text-slate-500">
                Exact format: 172.16.x.0/24. For example, 172.16.8.0/24 scans 172.16.8.1–172.16.8.254.
              </span>
            </label>
            <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#012c50]">
              Discover Printers
            </button>
          </form>
        )}
      </Card>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-[#014171]">Latest Scan Results</h2>
          {latestScan && (
            <p className="mt-1 text-xs text-slate-500">
              {latestScan.agentName} · {latestScan.subnet} · requested {formatDateTime(latestScan.requestedAt)}
            </p>
          )}
        </div>
        {latestScan && <ScanStatus status={latestScan.status} count={results.length} />}
      </div>

      <TableCard>
        {!latestScan ? (
          <EmptyResults message="No network scan has been requested yet." />
        ) : latestScan.status === "queued" || latestScan.status === "running" ? (
          <EmptyResults message={latestScan.status === "queued" ? "Waiting for the selected agent to claim the scan…" : "The agent is scanning the network…"} />
        ) : latestScan.status === "failed" ? (
          <EmptyResults message={latestScan.errorMessage || "The network scan failed."} />
        ) : results.length === 0 ? (
          <EmptyResults message="No SNMP-enabled printers responded on this subnet." />
        ) : (
          <table className="w-full min-w-[900px] table-fixed text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="w-[17%] whitespace-nowrap px-4 py-3">IP Address</th>
                <th className="w-[19%] whitespace-nowrap px-4 py-3">Serial Number</th>
                <th className="w-[16%] whitespace-nowrap px-4 py-3">Brand</th>
                <th className="w-[27%] whitespace-nowrap px-4 py-3">Model / Description</th>
                <th className="w-[21%] whitespace-nowrap px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map((printer) => {
                const registeredId = registeredByIp.get(printer.ip);
                const addHref = buildAddPrinterHref(printer, latestScan.agentId);
                return (
                  <tr key={printer.ip} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-[#014171]">{printer.ip}</td>
                    <td className="px-4 py-3">{printer.serialNumber || "—"}</td>
                    <td className="px-4 py-3">{printer.brand || "—"}</td>
                    <td className="px-4 py-3">
                      <p className="truncate font-medium" title={printer.model || printer.description}>{printer.model || printer.description || "—"}</p>
                      {printer.model && printer.description !== printer.model && <p className="mt-1 truncate text-xs text-slate-400" title={printer.description}>{printer.description}</p>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {registeredId ? (
                        <Link href={printerDetailHref(registeredId, "/printdash/discover")} className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
                          View Registered Printer
                        </Link>
                      ) : (
                        <Link href={addHref} className="inline-flex rounded-lg bg-[#014171] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#012c50]">
                          Add Printer
                        </Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </TableCard>
    </div>
  );
}

function buildAddPrinterHref(printer: DiscoveredPrinter, agentId: number) {
  const params = new URLSearchParams({
    ip: printer.ip,
    serial: printer.serialNumber ?? "",
    brand: printer.brand ?? "",
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

function EmptyResults({ message }: { message: string }) {
  return <div className="flex min-h-52 items-center justify-center px-6 text-center text-sm text-slate-500">{message}</div>;
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila" });
}
