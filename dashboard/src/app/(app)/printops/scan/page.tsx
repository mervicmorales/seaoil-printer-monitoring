import { Clock3, Download, FileText, Radar, TriangleAlert } from "lucide";
import { Badge, Card, IconGlyph, PageHeader, TableCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import AgentSyncPanel from "../AgentSyncPanel";
import { getPrintOpsAgents, getRecentPrintOpsCommands } from "../data";
import PrintOpsFeedback from "../PrintOpsFeedback";
import PrintOpsSubmitButton from "../PrintOpsSubmitButton";
import { queueScanAction } from "../actions";

export const dynamic = "force-dynamic";

type ScanRequest = Awaited<ReturnType<typeof getRecentPrintOpsCommands>>[number];

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
    getRecentPrintOpsCommands("scan", 30),
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

      <Card className="mb-6 overflow-hidden">
        <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={Radar} size={19} />
          </span>
          <div>
            <h2 className="font-bold text-[#014171]">Start a scan</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Place the document in the selected scanner before starting. Large scans may take up to two minutes.
            </p>
          </div>
        </div>
        {!access.printops ? (
          <div className="m-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-700 sm:m-6">
            <span className="mt-0.5 shrink-0 text-slate-500"><IconGlyph icon={FileText} size={17} /></span>
            <div>
              <p className="font-semibold">View-only access</p>
              <p className="mt-0.5 text-xs text-slate-500">You can review scan requests and download completed files, but you cannot start a new scan.</p>
            </div>
          </div>
        ) : scannerTargets.length === 0 ? (
          <div className="m-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 sm:m-6">
            <span className="mt-0.5 shrink-0 text-amber-600"><IconGlyph icon={TriangleAlert} size={17} /></span>
            <div>
              <p className="font-semibold">No scanner available</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-700">No SANE-compatible scanners are available yet. Refresh an online office agent above.</p>
            </div>
          </div>
        ) : (
          <form action={queueScanAction} className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Scanner</span>
              <select name="target" required className={selectClassName}>
                {scannerTargets.map(({ agent, device }) => (
                  <option key={`${agent.id}-${device.id}`} value={`${agent.id}|${device.id}`}>
                    {agent.name} · {device.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Document source</span>
              <select name="source" defaultValue="Flatbed" className={selectClassName}>
                <option value="Flatbed">Flatbed · glass</option>
                <option value="ADF">ADF · simplex</option>
                <option value="ADF Duplex">ADF · duplex</option>
              </select>
            </label>
            <div className="flex border-t border-slate-200 pt-5 md:col-span-2 md:justify-end">
              <PrintOpsSubmitButton idleLabel="Scan Now" pendingLabel="Queueing…" />
            </div>
          </form>
        )}
      </Card>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Scan activity</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Scan requests</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {scans.length} records
        </span>
      </div>
      <TableCard className="h-[28rem]">
        {scans.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconGlyph icon={Radar} size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-700">No scan requests yet</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">New scan requests and their downloadable files will appear here.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 lg:hidden">
              {scans.map((scan) => <ScanRequestCard key={scan.id} scan={scan} />)}
            </div>
            <div className="hidden lg:block">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50/95 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  <tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Agent</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scans.map((scan) => (
                    <tr key={scan.id} className="transition hover:bg-slate-50/70">
                      <td className="px-4 py-4 font-semibold text-slate-800">{scan.outputFileName || `Scan #${scan.id}`}</td>
                      <td className="px-4 py-4 text-slate-600">{scan.agentName}</td>
                      <td className="px-4 py-4 text-slate-600">{payloadText(scan.payload, "source") || "—"}</td>
                      <td className="px-4 py-4 text-xs font-medium text-slate-500">{formatDateTime(scan.requestedAt)}</td>
                      <td className="px-4 py-4">
                        <Badge color={statusColor(scan.status)}>{scan.status}</Badge>
                        {scan.errorMessage && <p className="mt-1.5 max-w-xs text-xs leading-5 text-red-600">{scan.errorMessage}</p>}
                      </td>
                      <td className="px-4 py-4 text-right"><ScanDownloadAction scan={scan} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </TableCard>
    </div>
  );
}

function ScanRequestCard({ scan }: { scan: ScanRequest }) {
  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={FileText} size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">{scan.outputFileName || `Scan #${scan.id}`}</p>
            <p className="mt-1 text-xs text-slate-500">{scan.agentName}</p>
          </div>
        </div>
        <Badge color={statusColor(scan.status)}>{scan.status}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5">
        <div>
          <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Source</dt>
          <dd className="mt-1 text-xs font-semibold text-slate-700">{payloadText(scan.payload, "source") || "—"}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><IconGlyph icon={Clock3} size={11} /> Requested</dt>
          <dd className="mt-1 text-xs font-medium leading-5 text-slate-600">{formatDateTime(scan.requestedAt)}</dd>
        </div>
      </dl>
      {scan.errorMessage && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{scan.errorMessage}</p>}
      {scan.status === "completed" && scan.outputFileName && (
        <div className="mt-4"><ScanDownloadAction scan={scan} fullWidth /></div>
      )}
    </article>
  );
}

function ScanDownloadAction({ scan, fullWidth = false }: { scan: ScanRequest; fullWidth?: boolean }) {
  if (scan.status !== "completed" || !scan.outputFileName) return <span className="text-slate-400">—</span>;
  return (
    <a
      href={`/api/printops/scans/${scan.id}`}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 hover:shadow-md ${fullWidth ? "w-full" : ""}`}
    >
      <IconGlyph icon={Download} size={14} />
      Download
    </a>
  );
}

const selectClassName = "h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15";
function payloadText(payload: Record<string, unknown>, key: string) { return typeof payload[key] === "string" ? payload[key] : ""; }
function statusColor(status: string): "green" | "yellow" | "red" | "gray" { if (status === "completed") return "green"; if (status === "failed") return "red"; if (status === "queued" || status === "running") return "yellow"; return "gray"; }
function formatTime(value: Date) { return value.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function formatDateTime(value: Date) { return value.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }); }
