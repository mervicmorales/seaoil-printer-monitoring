import { Badge, Card } from "@/components/ui";
import type { PrintOpsAgent } from "./data";
import { queuePrintOpsSyncAction } from "./actions";
import PrintOpsRefreshButton from "./PrintOpsRefreshButton";

export default function AgentSyncPanel({
  agents,
  returnTo,
}: {
  agents: PrintOpsAgent[];
  returnTo: "/printops/print" | "/printops/scan" | "/printops/jobs";
}) {
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-semibold text-[#014171]">Office Agents</h2>
          <p className="mt-1 text-sm text-slate-500">
            Refresh to retrieve current CUPS printers, scanners, and print queues.
          </p>
        </div>
      </div>
      {agents.length === 0 ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No monitoring agent with an active credential is configured.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{agent.name}</p>
                  <Badge color={agent.status === "online" ? "green" : "gray"}>
                    {agent.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {agent.hostname || "Hostname unavailable"} · {agent.snapshotAt
                    ? `Data from ${formatDateTime(agent.snapshotAt)}`
                    : "No PrintOps data yet"}
                </p>
              </div>
              <form action={queuePrintOpsSyncAction}>
                <input type="hidden" name="agentId" value={agent.id} />
                <input type="hidden" name="returnTo" value={returnTo} />
                <PrintOpsRefreshButton />
              </form>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}
