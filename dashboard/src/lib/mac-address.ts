export function normalizeMacAddress(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (!/^(?:[\da-f]{12}|(?:[\da-f]{2}:){5}[\da-f]{2}|(?:[\da-f]{2}-){5}[\da-f]{2}|(?:[\da-f]{4}\.){2}[\da-f]{4})$/i.test(text)) return null;
  const hex = text.replace(/[:.-]/g, "").toUpperCase();
  if (hex === "000000000000" || (parseInt(hex.slice(0, 2), 16) & 1) !== 0) return null;
  return hex.match(/.{2}/g)!.join(":");
}
