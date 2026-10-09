import { Clock3, FileText, Printer, Send, TriangleAlert } from "lucide";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge, Card, IconGlyph, PageHeader, TableCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { getModuleAccessMap, requireModuleFullAccess, requireSession } from "@/lib/server-utils";
import { isSuperAdmin } from "@/lib/roles";
import AgentSyncPanel from "../AgentSyncPanel";
import {
  getPrintOpsAgents,
  getPrintOpsActivityPrinter,
  getPrintOpsLocationScope,
  getRecentPrintOpsCommands,
  getUserPrinterPermissionIds,
} from "../data";
import PrintOpsFeedback from "../PrintOpsFeedback";
import { queueDurablePrintAction } from "../actions";
import PrintTargetSelect from "./PrintTargetSelect";

type PrintRequest = Awaited<ReturnType<typeof getRecentPrintOpsCommands>>[number];
type ActivityPrinter = ReturnType<typeof getPrintOpsActivityPrinter>;

export async function PrintOpsPrintPageContent({
  searchParams,
  employeeMode = false,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
  employeeMode?: boolean;
}) {
  const session = employeeMode
    ? await requireSession()
    : await requireModuleFullAccess("printops");
  if (employeeMode && session.role !== "employee") redirect("/overview");

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
  const printerScope = (session.role === "employee" || session.role === "support") && locationScope
    ? { locationId: locationScope.locationId }
    : locationScope;
  const [agents, commands] = await Promise.all([
    locationScoped && !printerScope
      ? []
      : getPrintOpsAgents(
          printerScope ?? undefined,
          assignedPrinterIds,
          session.role === "support" || session.role === "employee"
            ? {
                departmentId: locationScope?.departmentId,
                subunitId: locationScope?.subunitId,
                costCenterId: locationScope?.costCenterId,
              }
            : undefined,
        ),
    getRecentPrintOpsCommands(
      "print",
      20,
      showAgentControls ? undefined : session.id,
    ),
  ]);
  const printerTargets = agents.flatMap((agent) =>
    agent.snapshot.printerTargets.map((printer) => ({ agent, printer })),
  );
  const renderedAt = new Date();

  return (
    <div>
      <PageHeader
        parentTitle="Printer Services"
        title="Print"
        subtitle="Send documents to assigned printers through authenticated office agents."
        actions={<RefreshControl refreshedAtLabel={formatDateTime(renderedAt)} intervalSeconds={5} iconOnly />}
      />
      <PrintOpsFeedback success={params.success} error={params.error} />
      {showAgentControls && (
        <AgentSyncPanel agents={agents} returnTo="/printops/print" canManage={access.printops} />
      )}

      <Card className="mb-6 overflow-hidden">
        <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={Send} size={18} />
          </span>
          <div>
            <h2 className="font-bold text-[#014171]">Send a file to print</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Files are transferred securely to the selected office agent and removed from the command after submission.
            </p>
          </div>
        </div>
        {!employeeMode && !access.printops ? (
          <div className="m-5 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-slate-700 sm:m-6">
            <span className="mt-0.5 shrink-0 text-slate-500"><IconGlyph icon={FileText} size={17} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">View-only access</p>
              <p className="mt-0.5 text-xs text-slate-500">You can review print requests, but you cannot submit a new document.</p>
            </div>
          </div>
        ) : printerTargets.length === 0 ? (
          <div className="m-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 sm:m-6">
            <span className="mt-0.5 shrink-0 text-amber-600"><IconGlyph icon={TriangleAlert} size={17} /></span>
            <div>
              <p className="font-semibold">No printer available</p>
              <p className="mt-0.5 text-xs leading-5 text-amber-700">
                {locationScoped
                  ? "No permitted printers at your assigned office and department are currently online."
                  : showAgentControls
                    ? "No assigned printers are currently online. Refresh an online office agent above."
                    : "No assigned printers are currently online."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href={employeeMode ? "/portal/print" : "/printops/print"} className="inline-flex min-h-9 items-center justify-center rounded-lg border border-amber-300 bg-white px-3 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100">Retry</Link>
                {showAgentControls && <Link href="/monitoring-agents" className="inline-flex min-h-9 items-center justify-center rounded-lg bg-[#014171] px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-[#00365f]">View monitoring agents</Link>}
              </div>
            </div>
          </div>
        ) : (
          <form action={queueDurablePrintAction} className="grid gap-5 p-5 sm:p-6 lg:grid-cols-2">
            <PrintTargetSelect
              agents={agents.map((agent) => ({
                id: agent.id,
                name: agent.name,
                printers: agent.snapshot.printerTargets,
              }))}
              selectClassName={selectClassName}
              hideAgentSelector={!showAgentControls}
            />
          </form>
        )}
      </Card>

      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#4f7fa9]">Print activity</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.015em] text-[#014171]">Recent print requests</h2>
        </div>
        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {commands.length} records
        </span>
      </div>
      <TableCard className={commands.length > 8 ? "max-h-[30rem]" : ""}>
        {commands.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <IconGlyph icon={Printer} size={22} />
            </span>
            <p className="mt-4 text-sm font-semibold text-slate-700">No print requests yet</p>
            <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">Submitted documents and their processing status will appear here.</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 lg:hidden">
              {commands.map((command) => (
                <PrintRequestCard
                  key={command.id}
                  command={command}
                  printer={getPrintOpsActivityPrinter(command, agents)}
                />
              ))}
            </div>
            <div className="hidden lg:block">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50/95 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">
                  <tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Office / Department</th><th className="px-4 py-3">Printer Model / Serial Number</th><th className="px-4 py-3">Date Requested</th><th className="px-4 py-3">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commands.map((command) => {
                    const printer = getPrintOpsActivityPrinter(command, agents);
                    return (
                      <tr key={command.id} className="transition hover:bg-slate-50/70">
                        <td className="px-4 py-4 font-semibold text-slate-800">{command.inputFileName || "File"}</td>
                        <td className="px-4 py-4"><PrimarySecondary primary={printer.location} secondary={printer.department} /></td>
                        <td className="px-4 py-4"><PrimarySecondary primary={printer.model} secondary={printer.serialNumber} monoSecondary /></td>
                        <td className="px-4 py-4 text-xs font-medium text-slate-500">{formatDateTime(command.requestedAt)}</td>
                        <td className="px-4 py-4">
                          <Badge color={statusColor(command.status)}>{command.status}</Badge>
                          {command.errorMessage && <p className="mt-1.5 max-w-xs text-xs leading-5 text-red-600">{command.errorMessage}</p>}
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

function PrintRequestCard({ command, printer }: { command: PrintRequest; printer: ActivityPrinter }) {
  return (
    <article className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={FileText} size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-800">{command.inputFileName || "File"}</p>
            <p className="mt-1 text-xs text-slate-500">{printer.location} · {printer.department}</p>
          </div>
        </div>
        <Badge color={statusColor(command.status)}>{command.status}</Badge>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><IconGlyph icon={Printer} size={11} /> Printer Model / Serial Number</dt>
          <dd className="mt-1 break-words text-xs font-semibold text-slate-700">{printer.model}<span className="mt-0.5 block font-mono font-medium text-slate-500">{printer.serialNumber}</span></dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400"><IconGlyph icon={Clock3} size={11} /> Date Requested</dt>
          <dd className="mt-1 text-xs font-medium leading-5 text-slate-600">{formatDateTime(command.requestedAt)}</dd>
        </div>
      </dl>
      {command.errorMessage && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-5 text-red-700">{command.errorMessage}</p>}
    </article>
  );
}

function PrimarySecondary({ primary, secondary, monoSecondary = false }: { primary: string; secondary: string; monoSecondary?: boolean }) {
  return <div className="min-w-0"><p className="font-semibold text-slate-700">{primary}</p><p className={`mt-0.5 text-xs text-slate-500 ${monoSecondary ? "font-mono" : ""}`}>{secondary}</p></div>;
}

const inputClassName = "h-11 w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-700 shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15";
const selectClassName = `${inputClassName} bg-white`;

function statusColor(status: string): "green" | "yellow" | "red" | "gray" {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "queued" || status === "running") return "yellow";
  return "gray";
}
function formatTime(value: Date) { return value.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function formatDateTime(value: Date) { return value.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }); }
