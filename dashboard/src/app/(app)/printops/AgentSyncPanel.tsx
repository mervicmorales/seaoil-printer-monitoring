import { Activity, TriangleAlert } from "lucide";
import { Badge, Card, IconGlyph } from "@/components/ui";
import type { PrintOpsAgent } from "./data";
import { queuePrintOpsSyncAction } from "./actions";
import PrintOpsRefreshButton from "./PrintOpsRefreshButton";

export default function AgentSyncPanel({
  agents,
  returnTo,
  canManage,
}: {
  agents: PrintOpsAgent[];
  returnTo: "/printops/print" | "/printops/scan";
  canManage: boolean;
}) {
  return (
    <Card className="mb-6 overflow-hidden">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={Activity} size={18} />
          </span>
          <div>
            <h2 className="font-bold text-[#014171]">Office agents</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Refresh to retrieve current CUPS printers, scanners, and print queues.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
          {agents.length} configured
        </span>
      </div>
      {agents.length === 0 ? (
        <div className="m-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-800 sm:m-6">
          <span className="mt-0.5 shrink-0 text-amber-600"><IconGlyph icon={TriangleAlert} size={17} /></span>
          <div>
            <p className="font-semibold">No active office agent</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-700">No monitoring agent with an active credential is configured.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-2">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-slate-300 sm:flex-row sm:items-center"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{agent.name}</p>
                  <Badge color={agent.status === "online" ? "green" : "gray"}>
                    {agent.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {agent.hostname || "Hostname unavailable"} · {agent.snapshotAt
                    ? `Data from ${formatDateTime(agent.snapshotAt)}`
                    : "No PrintOps data yet"}
                </p>
              </div>
              {canManage && (
                <form action={queuePrintOpsSyncAction}>
                  <input type="hidden" name="agentId" value={agent.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <PrintOpsRefreshButton />
                </form>
              )}
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
