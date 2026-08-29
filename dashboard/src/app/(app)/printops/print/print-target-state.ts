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
  const brandModel = [printer.brand, printer.model].filter(Boolean).join(" ") || "Unknown brand/model";
  const serial = printer.serialNumber || "Unknown serial";
  return `${department} | ${brandModel} | SN: ${serial}`;
}
