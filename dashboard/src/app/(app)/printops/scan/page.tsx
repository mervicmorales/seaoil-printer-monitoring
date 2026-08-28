import { Badge, Card, PageHeader, TableCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import AgentSyncPanel from "../AgentSyncPanel";
import { getPrintOpsAgents, getRecentPrintOpsCommands } from "../data";
import PrintOpsFeedback from "../PrintOpsFeedback";
import PrintOpsSubmitButton from "../PrintOpsSubmitButton";
import { queueScanAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PrintOpsScanPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const params = await searchParams;
  const [agents, scans] = await Promise.all([
    getPrintOpsAgents(),
    getRecentPrintOpsCommands("scan", 30, session.role === "admin" ? undefined : session.id),
  ]);
  const scannerTargets = agents.flatMap((agent) =>
    agent.snapshot.scanDevices.map((device) => ({ agent, device })),
  );
  const renderedAt = new Date();

  return (
    <div>
      <PageHeader
        title="PrintOps · Scan"
        subtitle="Start a scan on an office scanner and download the completed file securely."
        actions={<RefreshControl refreshedAtLabel={formatTime(renderedAt)} intervalSeconds={5} />}
      />
      <PrintOpsFeedback success={params.success} error={params.error} />
      <AgentSyncPanel agents={agents} returnTo="/printops/scan" canManage={access.printops} />

      <Card className="mb-6 p-5 sm:p-6">
        <h2 className="font-semibold text-[#014171]">Start a Scan</h2>
        <p className="mt-1 text-sm text-slate-500">
          Place the document in the selected scanner before starting. Large scans may take up to two minutes.
        </p>
        {!access.printops ? (
          <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            You have view-only access to PrintOps.
          </p>
        ) : scannerTargets.length === 0 ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No SANE-compatible scanners are available yet. Refresh an online office agent above.
          </p>
        ) : (
          <form action={queueScanAction} className="mt-5 grid gap-4 md:grid-cols-2 md:items-end">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Scanner</span>
              <select name="target" required className={selectClassName}>
                {scannerTargets.map(({ agent, device }) => (
                  <option key={`${agent.id}-${device.id}`} value={`${agent.id}|${device.id}`}>
                    {agent.name} · {device.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700">Source</span>
              <select name="source" defaultValue="Flatbed" className={selectClassName}>
                <option value="Flatbed">Flatbed · glass</option>
                <option value="ADF">ADF · simplex</option>
                <option value="ADF Duplex">ADF · duplex</option>
              </select>
            </label>
            <div className="md:col-span-2">
              <PrintOpsSubmitButton idleLabel="Scan Now" pendingLabel="Queueing…" />
            </div>
          </form>
        )}
      </Card>

      <h2 className="mb-3 text-base font-semibold text-[#014171]">Scan Requests</h2>
      <TableCard className="h-[28rem]">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Agent</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {scans.map((scan) => (
              <tr key={scan.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{scan.outputFileName || `Scan #${scan.id}`}</td>
                <td className="px-4 py-3 text-slate-600">{scan.agentName}</td>
                <td className="px-4 py-3 text-slate-600">{payloadText(scan.payload, "source") || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(scan.requestedAt)}</td>
                <td className="px-4 py-3">
                  <Badge color={statusColor(scan.status)}>{scan.status}</Badge>
                  {scan.errorMessage && <p className="mt-1 max-w-xs text-xs text-red-600">{scan.errorMessage}</p>}
                </td>
                <td className="px-4 py-3 text-right">
                  {scan.status === "completed" && scan.outputFileName ? (
                    <a href={`/api/printops/scans/${scan.id}`} className="inline-flex rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">
                      Download
                    </a>
                  ) : <span className="text-slate-400">—</span>}
                </td>
              </tr>
            ))}
            {scans.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">No scan requests yet.</td></tr>}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

const selectClassName = "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40";
function payloadText(payload: Record<string, unknown>, key: string) { return typeof payload[key] === "string" ? payload[key] : ""; }
function statusColor(status: string): "green" | "yellow" | "red" | "gray" { if (status === "completed") return "green"; if (status === "failed") return "red"; if (status === "queued" || status === "running") return "yellow"; return "gray"; }
function formatTime(value: Date) { return value.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function formatDateTime(value: Date) { return value.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }); }
