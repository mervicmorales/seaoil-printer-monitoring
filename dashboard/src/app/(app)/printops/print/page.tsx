import { Badge, Card, PageHeader, TableCard } from "@/components/ui";
import RefreshControl from "@/components/RefreshControl";
import { requireSession } from "@/lib/server-utils";
import AgentSyncPanel from "../AgentSyncPanel";
import { getPrintOpsAgents, getRecentPrintOpsCommands } from "../data";
import PrintOpsFeedback from "../PrintOpsFeedback";
import { queuePrintAction } from "../actions";
import PrintFilePreview from "./PrintFilePreview";
import PrintTargetSelect from "./PrintTargetSelect";

export const dynamic = "force-dynamic";

export default async function PrintOpsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  const session = await requireSession();
  const params = await searchParams;
  const [agents, commands] = await Promise.all([
    getPrintOpsAgents(),
    getRecentPrintOpsCommands("print", 20, session.role === "admin" ? undefined : session.id),
  ]);
  const printerTargets = agents.flatMap((agent) =>
    agent.snapshot.printerTargets.map((printer) => ({ agent, printer })),
  );
  const renderedAt = new Date();

  return (
    <div>
      <PageHeader
        title="PrintOps · Print"
        subtitle="Send documents to assigned printers through authenticated office agents."
        actions={<RefreshControl refreshedAtLabel={formatTime(renderedAt)} intervalSeconds={5} />}
      />
      <PrintOpsFeedback success={params.success} error={params.error} />
      <AgentSyncPanel agents={agents} returnTo="/printops/print" />

      <Card className="mb-6 p-5 sm:p-6">
        <h2 className="font-semibold text-[#014171]">Send a File to Print</h2>
        <p className="mt-1 text-sm text-slate-500">
          Files are transferred to the selected office agent and removed from the command after submission.
        </p>
        {printerTargets.length === 0 ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            No assigned printers are currently online. Refresh an online office agent above.
          </p>
        ) : (
          <form action={queuePrintAction} className="mt-5 grid gap-4 lg:grid-cols-2">
            <PrintTargetSelect
              agents={agents.map((agent) => ({
                id: agent.id,
                name: agent.name,
                printers: agent.snapshot.printerTargets,
              }))}
              selectClassName={selectClassName}
            />
            <PrintFilePreview />
          </form>
        )}
      </Card>

      <h2 className="mb-3 text-base font-semibold text-[#014171]">Recent Print Requests</h2>
      <TableCard className="h-[24rem]">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">File</th><th className="px-4 py-3">Agent</th><th className="px-4 py-3">Printer</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {commands.map((command) => (
              <tr key={command.id}>
                <td className="px-4 py-3 font-medium text-slate-800">{command.inputFileName || "File"}</td>
                <td className="px-4 py-3 text-slate-600">{command.agentName}</td>
                <td className="px-4 py-3 text-slate-600">{payloadText(command.payload, "printerName") || payloadText(command.payload, "printer") || "—"}</td>
                <td className="px-4 py-3 text-slate-500">{formatDateTime(command.requestedAt)}</td>
                <td className="px-4 py-3">
                  <Badge color={statusColor(command.status)}>{command.status}</Badge>
                  {command.errorMessage && <p className="mt-1 max-w-xs text-xs text-red-600">{command.errorMessage}</p>}
                </td>
              </tr>
            ))}
            {commands.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">No print requests yet.</td></tr>}
          </tbody>
        </table>
      </TableCard>
    </div>
  );
}

const inputClassName = "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40";
const selectClassName = `${inputClassName} bg-white`;

function payloadText(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key] : "";
}
function statusColor(status: string): "green" | "yellow" | "red" | "gray" {
  if (status === "completed") return "green";
  if (status === "failed") return "red";
  if (status === "queued" || status === "running") return "yellow";
  return "gray";
}
function formatTime(value: Date) { return value.toLocaleTimeString("en-PH", { timeZone: "Asia/Manila", hour: "numeric", minute: "2-digit", second: "2-digit" }); }
function formatDateTime(value: Date) { return value.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" }); }
