"use client";

import { useState } from "react";
import type { PrintOpsPrinterTarget } from "@/lib/printops";
import PrintFilePreview from "./PrintFilePreview";
import { getDefaultPrintTarget } from "./print-target-state";
import SearchableDropdown from "@/components/SearchableDropdown";

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
        <div className="block">
          <SearchableDropdown
            label="Office agent"
            value={agentId}
            onValueChange={setAgentId}
            required
            placeholder="Search office agents..."
            options={agents.map((agent) => ({ value: String(agent.id), label: `${agent.name}${agent.printers.length === 0 ? " · no available printers" : ""}` }))}
            inputClassName={selectClassName}
            labelClassName="!font-semibold"
          />
          <span className="mt-1.5 block text-xs text-slate-500">
            {selectedAgent
              ? `${selectedAgent.printers.length} available ${selectedAgent.printers.length === 1 ? "printer" : "printers"}`
              : "Select the office agent that will process this print request."}
          </span>
        </div>
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
