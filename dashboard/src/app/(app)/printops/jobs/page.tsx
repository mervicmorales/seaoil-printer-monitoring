import { CircleCheckBig, FileText, Printer, TriangleAlert, X } from "lucide";
import { Badge, Card, IconGlyph, PageHeader, StatCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import { printOpsJobId } from "@/lib/printops";
import AgentSyncPanel from "../AgentSyncPanel";
import { getPrintOpsAgents, getRecentPrintOpsCommands } from "../data";
import PrintOpsFeedback from "../PrintOpsFeedback";
import { cancelPrintJobAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PrintOpsJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const params = await searchParams;
  const [agents, cancellations] = await Promise.all([
    getPrintOpsAgents(),
    getRecentPrintOpsCommands("cancel-job", 10),
  ]);
  const renderedAt = new Date();
  const onlineAgentCount = agents.filter((agent) => agent.status === "online").length;
  const physicalPrinterCount = agents.reduce((total, agent) => total + agent.physicalPrinters.length, 0);
  const activeJobCount = agents.reduce((total, agent) => total + agent.snapshot.activeJobs.length, 0);

  return (
    <div>
      <PageHeader
        title="PrintOps · Print Jobs"
        subtitle="Review live physical printer states and CUPS queues."
        actions={<RefreshControl refreshedAtLabel={formatTime(renderedAt)} intervalSeconds={5} />}
      />
      <PrintOpsFeedback success={params.success} error={params.error} />
      <AgentSyncPanel agents={agents} returnTo="/printops/jobs" canManage={access.printops} />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard compact label="Online agents" value={`${onlineAgentCount}/${agents.length}`} icon={CircleCheckBig} accent="#07834c" />
        <StatCard compact label="Monitored printers" value={physicalPrinterCount} icon={Printer} accent="#014171" />
        <StatCard compact label="Active print jobs" value={activeJobCount} icon={FileText} accent="#c47f08" />
      </div>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Queue monitoring</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Office print queues</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {agents.length} {agents.length === 1 ? "agent" : "agents"}
        </span>
      </div>

      <div className="space-y-6">
        {agents.map((agent) => (
          <Card key={agent.id} className="overflow-hidden">
            <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                  <IconGlyph icon={FileText} size={18} />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-[#014171]">{agent.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{agent.hostname || "Hostname unavailable"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                  {agent.snapshot.activeJobs.length} active
                </span>
                <Badge color={agent.status === "online" ? "green" : "gray"}>{agent.status}</Badge>
              </div>
            </div>

            <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-2">
              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[#014171]"><IconGlyph icon={Printer} size={16} /></span>
                    <h4 className="text-sm font-bold text-slate-700">Physical printer status</h4>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{agent.physicalPrinters.length} printers</span>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto overscroll-contain pr-1">
                  {agent.physicalPrinters.map((printer) => {
                    const target = agent.snapshot.printerTargets.find((item) => item.printerId === printer.id);
                    const cupsPrinter = target
                      ? agent.snapshot.printers.find((item) => item.name === target.queue)
                      : null;
                    return (
                      <div key={printer.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm transition hover:border-slate-300">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-bold text-slate-800">{printer.model || "Unknown model"}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{printer.department || "No department"}</p>
                          </div>
                          <Badge color={physicalStatusColor(printer.status, printer.online)}>{printer.status}</Badge>
                        </div>
                        <p className="mt-2 font-mono text-[11px] font-medium text-slate-500">SN: {printer.serialNumber}</p>
                        <div className="mt-2 flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
                          <span>Checked {formatDateTime(printer.checkedAt)}</span>
                          {target && <span>CUPS: {target.queue} · {cupsPrinter?.state || "Unknown"}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {agent.physicalPrinters.length === 0 && (
                    <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                      <span className="text-slate-400"><IconGlyph icon={Printer} size={20} /></span>
                      <p className="mt-2 text-sm font-semibold text-slate-600">No monitored printers</p>
                      <p className="mt-1 text-xs text-slate-500">This agent has not reported a physical printer.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="min-w-0">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[#014171]"><IconGlyph icon={FileText} size={16} /></span>
                    <h4 className="text-sm font-bold text-slate-700">Active queue</h4>
                  </div>
                  <span className="text-xs font-semibold text-slate-400">{agent.snapshot.activeJobs.length} jobs</span>
                </div>
                <div className="max-h-80 space-y-2 overflow-auto overscroll-contain pr-1">
                  {agent.snapshot.activeJobs.map((job) => {
                    const jobId = printOpsJobId(job);
                    return (
                      <div key={job} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-slate-300 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <IconGlyph icon={FileText} size={15} />
                          </span>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Job {jobId}</p>
                            <p className="mt-1 break-all text-xs leading-5 text-slate-700">{job}</p>
                          </div>
                        </div>
                        {access.printops && (
                          <form action={cancelPrintJobAction} className="shrink-0">
                            <input type="hidden" name="agentId" value={agent.id} />
                            <input type="hidden" name="jobId" value={jobId} />
                            <button type="submit" className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:bg-red-100 sm:w-auto">
                              <IconGlyph icon={X} size={13} />
                              Cancel
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                  {agent.snapshot.activeJobs.length === 0 && (
                    <div className="flex min-h-32 flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 text-center">
                      <span className="text-emerald-600"><IconGlyph icon={CircleCheckBig} size={20} /></span>
                      <p className="mt-2 text-sm font-semibold text-emerald-700">Print queue is clear</p>
                      <p className="mt-1 text-xs text-emerald-600">There are no active print jobs for this agent.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </Card>
        ))}
        {agents.length === 0 && (
          <Card className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconGlyph icon={FileText} size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-700">No office agents configured</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Print queues will appear after an office agent is configured and synchronized.</p>
          </Card>
        )}
      </div>

      {cancellations.some((command) => command.status === "failed") && (
        <Card className="mt-6 flex items-start gap-3 border-red-200 bg-red-50/60 p-4 text-sm text-red-700">
          <span className="mt-0.5 shrink-0"><IconGlyph icon={TriangleAlert} size={17} /></span>
          <div>
            <p className="font-semibold">Recent cancellation failed</p>
            <p className="mt-0.5 text-xs leading-5">Refresh agent data and verify that the CUPS job is still active.</p>
          </div>
        </Card>
      )}
    </div>
  );
}

function formatTime(value: Date) { return value.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function formatDateTime(value: Date) { return value.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }); }
function physicalStatusColor(status: string, online: boolean): "green" | "yellow" | "red" | "blue" | "gray" {
  if (!online || ["offline", "stopped"].includes(status.toLowerCase())) return "red";
  if (status.toLowerCase() === "printing") return "blue";
  if (status.toLowerCase() === "warmup") return "yellow";
  if (status.toLowerCase() === "idle") return "green";
  return "gray";
}
