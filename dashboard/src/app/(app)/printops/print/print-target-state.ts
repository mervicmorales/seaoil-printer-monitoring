import type { PrintOpsPrinterTarget } from "@/lib/printops";

type AgentPrinters = {
  id: number;
  printers: Array<Pick<PrintOpsPrinterTarget, "printerId">>;
};

export function getDefaultPrintTarget(agents: AgentPrinters[], agentId: string) {
  const agent = agents.find((candidate) => String(candidate.id) === agentId);
  const printer = agent?.printers[0];
  return printer ? `${agent.id}|${printer.printerId}` : "";
}

export function printerLabel(printer: PrintOpsPrinterTarget) {
  const department = printer.department || "No department";
  const model = printer.model || "Unknown model";
  const serial = printer.serialNumber || "Unknown serial";
  return `${department} | ${model} | SN: ${serial}`;
}
