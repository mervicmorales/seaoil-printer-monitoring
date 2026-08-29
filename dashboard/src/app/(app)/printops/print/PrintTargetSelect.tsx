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
}: {
  agents: AgentOption[];
  selectClassName: string;
}) {
  const initialAgent = agents.find((agent) => agent.printers.length > 0) ?? agents[0];
  const [agentId, setAgentId] = useState(String(initialAgent?.id ?? ""));
  const selectedAgent = agents.find((agent) => String(agent.id) === agentId);

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Agent</span>
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
      </label>
      <PrintFilePreview
        key={agentId}
        initialTarget={getDefaultPrintTarget(agents, agentId)}
        selectedAgentId={agentId}
        printers={selectedAgent?.printers ?? []}
      />
    </>
  );
}
