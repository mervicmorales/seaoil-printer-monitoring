export type PrintOpsPrinter = { name: string; state: string };
export type PrintOpsPrinterTarget = {
  printerId: number;
  name: string;
  ip: string;
  queue: string;
  department: string | null;
  model: string | null;
  serialNumber: string | null;
};
export type PrintOpsScanDevice = { id: string; label: string };
export type PrintOpsScanFile = { name: string; size: number; mtime: string };

export type PrintOpsSnapshot = {
  cupsPrinters: string[];
  printerTargets: PrintOpsPrinterTarget[];
  printers: PrintOpsPrinter[];
  defaultPrinter: string | null;
  activeJobs: string[];
  completedJobs: string[];
  scanDevices: PrintOpsScanDevice[];
  scans: PrintOpsScanFile[];
  capturedAt: string | null;
};

export function normalizePrintOpsSnapshot(value: unknown): PrintOpsSnapshot {
  const source = isRecord(value) ? value : {};
  return {
    cupsPrinters: stringArray(source.cupsPrinters),
    printerTargets: objectArray(source.printerTargets)
      .map((item) => ({
        printerId: number(item.printerId),
        name: text(item.name),
        ip: text(item.ip),
        queue: text(item.queue),
        department: text(item.department) || null,
        model: text(item.model) || null,
        serialNumber: text(item.serialNumber) || null,
      }))
      .filter((item) => item.printerId > 0 && item.name && item.queue),
    printers: objectArray(source.printers)
      .map((item) => ({ name: text(item.name), state: text(item.state) }))
      .filter((item) => item.name),
    defaultPrinter: text(source.defaultPrinter) || null,
    activeJobs: stringArray(source.activeJobs),
    completedJobs: stringArray(source.completedJobs),
    scanDevices: objectArray(source.scanDevices)
      .map((item) => ({ id: text(item.id), label: text(item.label) }))
      .filter((item) => item.id),
    scans: objectArray(source.scans)
      .map((item) => ({
        name: text(item.name),
        size: number(item.size),
        mtime: text(item.mtime),
      }))
      .filter((item) => item.name),
    capturedAt: text(source.capturedAt) || null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function objectArray(value: unknown) {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
