import { Clock3, FileText, Radar, TriangleAlert } from "lucide";
import { redirect } from "next/navigation";
import { Badge, Card, IconGlyph, PageHeader, TableCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { getModuleAccessMap, requireModuleFullAccess, requireSession } from "@/lib/server-utils";
import { isSuperAdmin } from "@/lib/roles";
import { scanExpiresAt, SCAN_RETENTION_HOURS } from "@/lib/scan-retention";
import AgentSyncPanel from "../AgentSyncPanel";
import {
  getPrintOpsAgents,
  getPrintOpsLocationScope,
  getRecentPrintOpsCommands,
  getUserPrinterPermissionIds,
} from "../data";
import PrintOpsFeedback from "../PrintOpsFeedback";
import PrintOpsSubmitButton from "../PrintOpsSubmitButton";
import { queueScanAction } from "../actions";
import ScanFileActions, { LatestScanAutoPreview } from "./ScanFileActions";
import ScanTargetFields from "./ScanTargetFields";

type ScanRequest = Awaited<ReturnType<typeof getRecentPrintOpsCommands>>[number];

export async function PrintOpsScanPageContent({
  searchParams,
  employeeMode = false,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
  employeeMode?: boolean;
}) {
  const session = employeeMode
    ? await requireSession()
    : await requireModuleFullAccess("printops");
  if (employeeMode && session.role !== "employee") redirect("/dashboard");

  const access = await getModuleAccessMap(session.id, session.role);
  const params = await searchParams;
  const locationScoped = session.role === "employee" || session.role === "support";
  const locationScope = locationScoped
    ? await getPrintOpsLocationScope(session.id)
    : undefined;
  const showAgentControls = isSuperAdmin(session.role);
  const assignedPrinterIds = session.role === "employee" || session.role === "support"
    ? await getUserPrinterPermissionIds(session.id)
    : undefined;
  const [agents, scans] = await Promise.all([
    locationScoped && !locationScope
      ? []
      : getPrintOpsAgents(
          locationScope ? { locationId: locationScope.locationId } : undefined,
          assignedPrinterIds,
          session.role === "support" || session.role === "employee"
            ? locationScope?.departmentId
            : undefined,
        ),
    getRecentPrintOpsCommands(
      "scan",
      30,
      showAgentControls ? undefined : session.id,
    ),
  ]);
  const scannerTargets = agents.flatMap((agent) =>
    agent.snapshot.scanDevices.map((device) => ({ agent, device })),
  );
  const renderedAt = new Date();
  const latestScan = scans[0];
  const recentCompletedScan = latestScan?.status === "completed"
    && latestScan.outputFileName
    && latestScan.hasOutputFile
    && latestScan.completedAt
    && renderedAt.getTime() - latestScan.completedAt.getTime() < 10 * 60 * 1_000
    ? {
        id: latestScan.id,
        name: latestScan.outputFileName,
        mimeType: latestScan.outputMimeType,
      }
    : null;

  return (
    <div>
      <PageHeader
        title={`${employeeMode ? "Printer Services" : "PrintOps"} · Scan`}
        subtitle="Start a scan on an office scanner and download the completed file securely."
        actions={<RefreshControl refreshedAtLabel={formatTime(renderedAt)} intervalSeconds={5} />}
      />
      <PrintOpsFeedback success={params.success} error={params.error} />
      <LatestScanAutoPreview scan={recentCompletedScan} />
      {showAgentControls && (
        <AgentSyncPanel agents={agents} returnTo="/printops/scan" canManage={access.printops} />
      )}

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
        {!employeeMode && !access.printops ? (
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
              <p className="mt-0.5 text-xs leading-5 text-amber-700">
                {locationScoped
                  ? "No scanner is currently available for your assigned location and printer permissions."
                  : showAgentControls
                    ? "No compatible scanners are available yet. Refresh an online office agent above."
                    : "No compatible scanners are currently available."}
              </p>
            </div>
          </div>
        ) : (
          <form action={queueScanAction} className="grid gap-4 p-5 sm:p-6 md:grid-cols-2">
            <ScanTargetFields targets={scannerTargets.map(({ agent, device }) => ({
              value: `${agent.id}|${device.id}`,
              label: scannerDisplayLabel(agent, device),
              sources: device.sources,
            }))} />
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
      <div className="mb-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
        <span className="mt-0.5 shrink-0 text-amber-600"><IconGlyph icon={Clock3} size={16} /></span>
        <div>
          <p className="text-xs font-bold">Save completed scans within {SCAN_RETENTION_HOURS} hours</p>
          <p className="mt-0.5 text-[11px] leading-5 text-amber-700">
            Scan files are permanently removed after {SCAN_RETENTION_HOURS} hours to protect sensitive documents and control storage. The activity record remains for reference.
          </p>
        </div>
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
                        <Badge color={statusColor(displayStatus(scan))}>{displayStatus(scan)}</Badge>
                        <ScanProgress status={scan.status} />
                        {scan.errorMessage && <p className="mt-1.5 max-w-xs text-xs leading-5 text-red-600">{scan.errorMessage}</p>}
                        <ScanRetentionReminder scan={scan} />
                      </td>
                      <td className="px-4 py-4 text-right"><ScanResultActions scan={scan} /></td>
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
        <Badge color={statusColor(displayStatus(scan))}>{displayStatus(scan)}</Badge>
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
      <ScanProgress status={scan.status} />
      <ScanRetentionReminder scan={scan} />
      {scan.status === "completed" && scan.outputFileName && (
        <div className="mt-4"><ScanResultActions scan={scan} fullWidth /></div>
      )}
    </article>
  );
}

function ScanResultActions({ scan, fullWidth = false }: { scan: ScanRequest; fullWidth?: boolean }) {
  if (scan.status !== "completed" || !scan.outputFileName) return <span className="text-slate-400">—</span>;
  if (!scan.hasOutputFile) return <span className="text-xs font-semibold text-slate-400">File expired</span>;
  return (
    <ScanFileActions
      scan={{ id: scan.id, name: scan.outputFileName, mimeType: scan.outputMimeType }}
      fullWidth={fullWidth}
    />
  );
}

function ScanRetentionReminder({ scan }: { scan: ScanRequest }) {
  if (scan.status !== "completed" || !scan.completedAt) return null;
  return scan.hasOutputFile ? (
    <p className="mt-1.5 text-[11px] font-medium leading-4 text-amber-700">
      Auto-deletes {formatDateTime(scanExpiresAt(scan.completedAt))}
    </p>
  ) : (
    <p className="mt-1.5 text-[11px] font-medium leading-4 text-slate-500">
      File automatically deleted after {SCAN_RETENTION_HOURS} hours
    </p>
  );
}

function ScanProgress({ status }: { status: string }) {
  if (status !== "queued" && status !== "running") return null;
  const running = status === "running";
  const label = running ? "Scanning document…" : "Waiting for office agent…";
  return (
    <div className="mt-2.5 w-full max-w-52" aria-live="polite">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold text-[#014171]">
        <span className={`size-1.5 shrink-0 rounded-full ${running ? "bg-emerald-500" : "bg-sky-500"} scan-progress-glow`} />
        <span>{label}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuetext={label}
        className="h-1.5 overflow-hidden rounded-full bg-slate-200 shadow-inner"
      >
        <span className={`scan-progress-indicator block h-full w-2/5 rounded-full bg-gradient-to-r ${running ? "from-emerald-400 via-emerald-500 to-teal-500" : "from-sky-400 via-[#1477b8] to-[#014171]"}`} />
      </div>
      {running && <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Keep the document in place until scanning finishes.</p>}
    </div>
  );
}

function scannerDisplayLabel(
  agent: Awaited<ReturnType<typeof getPrintOpsAgents>>[number],
  device: Awaited<ReturnType<typeof getPrintOpsAgents>>[number]["snapshot"]["scanDevices"][number],
) {
  const printer = agent.physicalPrinters.find((candidate) => candidate.id === device.printerId);
  return `${printer?.department || "No Department"} | ${printer?.model || "Unknown Model"} | SN: ${printer?.serialNumber || "Unknown"}`;
}

function payloadText(payload: Record<string, unknown>, key: string) { return typeof payload[key] === "string" ? payload[key] : ""; }
function displayStatus(scan: ScanRequest) { return scan.status === "completed" && !scan.hasOutputFile ? "expired" : scan.status; }
function statusColor(status: string): "green" | "yellow" | "red" | "gray" { if (status === "completed") return "green"; if (status === "failed") return "red"; if (status === "queued" || status === "running") return "yellow"; return "gray"; }
function formatTime(value: Date) { return value.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function formatDateTime(value: Date) { return value.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }); }
