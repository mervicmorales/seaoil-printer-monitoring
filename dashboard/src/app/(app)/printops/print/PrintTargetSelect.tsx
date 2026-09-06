"use client";

import { useState } from "react";
import type { PrintOpsPrinterTarget } from "@/lib/printops";
import PrintFilePreview from "./PrintFilePreview";
import { getDefaultPrintTarget } from "./print-target-state";

export type AgentOption = {
  id: number;
  name: string;
  printers: PrintOpsPrinterTarget[];
};

export default function PrintTargetSelect({
  agents,
  selectClassName,
  hideAgentSelector = false,
}: {
  agents: AgentOption[];
  selectClassName: string;
  hideAgentSelector?: boolean;
}) {
  const initialAgent = agents.find((agent) => agent.printers.length > 0) ?? agents[0];
  const [agentId, setAgentId] = useState(String(initialAgent?.id ?? ""));
  const selectedAgent = agents.find((agent) => String(agent.id) === agentId);
  const printerOptions = hideAgentSelector
    ? agents.flatMap((agent) => agent.printers.map((printer) => ({
        ...printer,
        agentId: agent.id,
      })))
    : selectedAgent?.printers ?? [];

  return (
    <>
      {!hideAgentSelector && (
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Office agent</span>
          <select
            value={agentId}
            onChange={(event) => setAgentId(event.target.value)}
            required
            className={selectClassName}
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}{agent.printers.length === 0 ? " · no available printers" : ""}
              </option>
            ))}
          </select>
          <span className="mt-1.5 block text-xs text-slate-500">
            {selectedAgent
              ? `${selectedAgent.printers.length} available ${selectedAgent.printers.length === 1 ? "printer" : "printers"}`
              : "Select the office agent that will process this print request."}
          </span>
        </label>
      )}
      <PrintFilePreview
        key={agentId}
        initialTarget={getDefaultPrintTarget(agents, agentId)}
        selectedAgentId={agentId}
        printers={printerOptions}
      />
    </>
  );
}
