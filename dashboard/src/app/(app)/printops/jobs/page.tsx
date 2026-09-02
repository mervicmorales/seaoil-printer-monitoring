import { Badge, Card, PageHeader } from "@/components/ui";
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

  return (
    <div>
      <PageHeader
        title="PrintOps · Print Jobs"
        subtitle="Review live physical printer states and CUPS queues."
        actions={<RefreshControl refreshedAtLabel={formatTime(renderedAt)} intervalSeconds={5} />}
      />
      <PrintOpsFeedback success={params.success} error={params.error} />
      <AgentSyncPanel agents={agents} returnTo="/printops/jobs" canManage={access.printops} />

      <div className="space-y-6">
        {agents.map((agent) => (
          <Card key={agent.id} className="overflow-hidden">
            <div className="flex flex-col justify-between gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="font-semibold text-[#014171]">{agent.name}</h2>
                <p className="mt-0.5 text-xs text-slate-500">{agent.hostname || "Hostname unavailable"}</p>
              </div>
              <Badge color={agent.status === "online" ? "green" : "gray"}>{agent.status}</Badge>
            </div>

            <div className="grid gap-6 p-5 xl:grid-cols-2">
              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Physical Printer Status</h3>
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  {agent.physicalPrinters.map((printer) => {
                    const target = agent.snapshot.printerTargets.find((item) => item.printerId === printer.id);
                    const cupsPrinter = target
                      ? agent.snapshot.printers.find((item) => item.name === target.queue)
                      : null;
                    return (
                      <div key={printer.id} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span className="min-w-0 font-medium text-slate-800">{physicalPrinterLabel(printer)}</span>
                          <Badge color={physicalStatusColor(printer.status, printer.online)}>{printer.status}</Badge>
                        </div>
                        <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>Checked {formatDateTime(printer.checkedAt)}</span>
                          {target && <span>CUPS: {target.queue} · {cupsPrinter?.state || "Unknown"}</span>}
                        </div>
                      </div>
                    );
                  })}
                  {agent.physicalPrinters.length === 0 && <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">No monitored printers reported.</p>}
                </div>
              </section>

              <section>
                <h3 className="mb-3 text-sm font-semibold text-slate-700">Active Queue ({agent.snapshot.activeJobs.length})</h3>
                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {agent.snapshot.activeJobs.map((job) => {
                    const jobId = printOpsJobId(job);
                    return (
                      <div key={job} className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                        <span className="break-all text-xs text-slate-700">{job}</span>
                        {access.printops && (
                          <form action={cancelPrintJobAction}>
                            <input type="hidden" name="agentId" value={agent.id} />
                            <input type="hidden" name="jobId" value={jobId} />
                            <button type="submit" className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100">Cancel</button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                  {agent.snapshot.activeJobs.length === 0 && <p className="rounded-lg bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-700">The print queue is empty.</p>}
                </div>
              </section>
            </div>
          </Card>
        ))}
        {agents.length === 0 && <Card className="p-8 text-center text-sm text-slate-500">No office agents are configured.</Card>}
      </div>

      {cancellations.some((command) => command.status === "failed") && (
        <Card className="mt-6 border-red-200 p-4 text-sm text-red-700">
          A recent cancellation failed. Refresh agent data and verify that the CUPS job is still active.
        </Card>
      )}
    </div>
  );
}

function formatTime(value: Date) { return value.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function formatDateTime(value: Date) { return value.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }); }
function physicalPrinterLabel(printer: { department: string | null; brand: string | null; model: string | null; serialNumber: string }) {
  const department = printer.department || "No department";
  const brandModel = [printer.brand, printer.model].filter(Boolean).join(" ") || "Unknown brand/model";
  return `${department} | ${brandModel} | SN: ${printer.serialNumber}`;
}
function physicalStatusColor(status: string, online: boolean): "green" | "yellow" | "red" | "blue" | "gray" {
  if (!online || ["offline", "stopped"].includes(status.toLowerCase())) return "red";
  if (status.toLowerCase() === "printing") return "blue";
  if (status.toLowerCase() === "warmup") return "yellow";
  if (status.toLowerCase() === "idle") return "green";
  return "gray";
}
