"use client";

import { useState } from "react";
import type { PrintOpsPrinterTarget } from "@/lib/printops";

type AgentOption = {
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
  const printers = selectedAgent?.printers ?? [];
  const [target, setTarget] = useState(
    initialAgent?.printers[0]
      ? `${initialAgent.id}|${initialAgent.printers[0].printerId}`
      : "",
  );

  function selectAgent(nextAgentId: string) {
    const nextAgent = agents.find((agent) => String(agent.id) === nextAgentId);
    setAgentId(nextAgentId);
    setTarget(
      nextAgent?.printers[0]
        ? `${nextAgent.id}|${nextAgent.printers[0].printerId}`
        : "",
    );
  }

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Agent</span>
        <select
          value={agentId}
          onChange={(event) => selectAgent(event.target.value)}
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

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Printer</span>
        <select
          name="target"
          value={target}
          onChange={(event) => setTarget(event.target.value)}
          required
          disabled={printers.length === 0}
          className={selectClassName}
        >
          {printers.length === 0 && <option value="">No available printers</option>}
          {printers.map((printer) => (
            <option
              key={printer.printerId}
              value={`${selectedAgent?.id}|${printer.printerId}`}
            >
              {printerLabel(printer)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function printerLabel(printer: PrintOpsPrinterTarget) {
  const department = printer.department || "No department";
  const brandModel = [printer.brand, printer.model].filter(Boolean).join(" ") || "Unknown brand/model";
  const serial = printer.serialNumber || "Unknown serial";
  return `${department} | ${brandModel} | SN: ${serial}`;
}
