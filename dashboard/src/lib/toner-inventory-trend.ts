export type TonerInventoryMovement = {
  date: string;
  type: string;
  quantity: number;
};

export function buildStockTrend(
  currentStock: number,
  dayKeys: readonly string[],
  movements: readonly TonerInventoryMovement[],
) {
  const dailyDeltas = new Map<string, number>();

  for (const movement of movements) {
    if (!dayKeys.includes(movement.date)) continue;
    const type = movement.type.trim().toLowerCase();
    const delta = type === "delivered" || type === "delivery"
      ? movement.quantity
      : type === "request"
        ? -movement.quantity
        : 0;
    dailyDeltas.set(movement.date, (dailyDeltas.get(movement.date) ?? 0) + delta);
  }

  const periodDelta = dayKeys.reduce((sum, day) => sum + (dailyDeltas.get(day) ?? 0), 0);
  let runningStock = currentStock - periodDelta;

  return dayKeys.map((day) => {
    runningStock += dailyDeltas.get(day) ?? 0;
    return Math.max(0, runningStock);
  });
}

