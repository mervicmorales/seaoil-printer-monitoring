export const TONER_TRANSACTION_STATUSES = ["Purchase", "Delivered", "Request"] as const;

export type TonerTransactionStatus = (typeof TONER_TRANSACTION_STATUSES)[number];

export function normalizeTonerTransactionStatus(value: string): TonerTransactionStatus | null {
  const normalized = value.trim().toLowerCase();
  if (normalized === "purchase") return "Purchase";
  if (normalized === "delivered" || normalized === "delivery") return "Delivered";
  if (normalized === "request") return "Request";
  return null;
}

export function tonerTransactionStatusLabel(value: string) {
  return normalizeTonerTransactionStatus(value) ?? value;
}

export function tonerInventoryDelta(type: string, quantity: number) {
  const status = normalizeTonerTransactionStatus(type);
  if (status === "Delivered") return quantity;
  if (status === "Request") return -quantity;
  if (status === "Purchase") return 0;
  throw new Error("InvalidTransactionType");
}

export function canTransitionTonerTransaction(existingType: string, nextType: string) {
  const existing = normalizeTonerTransactionStatus(existingType);
  const next = normalizeTonerTransactionStatus(nextType);
  if (!existing || !next) return false;
  if (existing === "Purchase") return next === "Purchase" || next === "Delivered";
  return next === existing;
}
