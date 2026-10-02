export const PRINTER_FLOORS = [
  "1st Floor",
  "2nd Floor",
  "7th Floor",
  "10th Floor",
  "19th Floor",
  "22nd Floor",
] as const;

export function normalizePrinterFloor(value: unknown) {
  const candidate = String(value ?? "").trim();
  if (!candidate) return null;
  return PRINTER_FLOORS.find((floor) => floor === candidate) ?? null;
}
