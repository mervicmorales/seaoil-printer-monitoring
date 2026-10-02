export const INVENTORY_MOVEMENT_PERIODS = ["7d", "30d", "90d"] as const;
export type InventoryMovementPeriod = (typeof INVENTORY_MOVEMENT_PERIODS)[number];

export type InventoryMovementRecord = {
  date: string;
  type: string;
  quantity: number;
};

export type InventoryWaterfallStep = {
  key: string;
  label: string;
  kind: "start" | "increase" | "decrease" | "unchanged" | "end";
  start: number;
  end: number;
  delta: number;
  deliveries: number;
  requests: number;
};

export type InventoryWaterfall = {
  startingStock: number;
  endingStock: number;
  delivered: number;
  requested: number;
  steps: InventoryWaterfallStep[];
};

export function buildInventoryWaterfall(
  currentStock: number,
  today: string,
  period: InventoryMovementPeriod,
  movements: readonly InventoryMovementRecord[],
): InventoryWaterfall {
  const periodDays = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const endDate = parseDate(today);
  const startDate = new Date(endDate);
  startDate.setUTCDate(endDate.getUTCDate() - (periodDays - 1));
  const startKey = isoDate(startDate);
  const periodMovements = movements.filter((movement) => movement.date >= startKey && movement.date <= today);
  const delivered = sumType(periodMovements, "delivery");
  const requested = sumType(periodMovements, "request");
  const startingStock = Math.max(0, currentStock - delivered + requested);
  const buckets = buildBuckets(startDate, endDate, period);
  let runningStock = startingStock;
  const steps: InventoryWaterfallStep[] = [{
    key: "start",
    label: "Start",
    kind: "start",
    start: 0,
    end: startingStock,
    delta: startingStock,
    deliveries: 0,
    requests: 0,
  }];

  for (const bucket of buckets) {
    const rows = periodMovements.filter((movement) => movement.date >= bucket.from && movement.date <= bucket.to);
    const bucketDeliveries = sumType(rows, "delivery");
    const bucketRequests = sumType(rows, "request");
    const delta = bucketDeliveries - bucketRequests;
    const nextStock = Math.max(0, runningStock + delta);
    steps.push({
      key: bucket.key,
      label: bucket.label,
      kind: delta > 0 ? "increase" : delta < 0 ? "decrease" : "unchanged",
      start: runningStock,
      end: nextStock,
      delta,
      deliveries: bucketDeliveries,
      requests: bucketRequests,
    });
    runningStock = nextStock;
  }

  steps.push({
    key: "end",
    label: "End",
    kind: "end",
    start: 0,
    end: currentStock,
    delta: currentStock,
    deliveries: 0,
    requests: 0,
  });

  return { startingStock, endingStock: currentStock, delivered, requested, steps };
}

function buildBuckets(startDate: Date, endDate: Date, period: InventoryMovementPeriod) {
  if (period === "7d") {
    return eachDate(startDate, endDate).map((date) => ({
      key: isoDate(date),
      label: new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", weekday: "short" }).format(date),
      from: isoDate(date),
      to: isoDate(date),
    }));
  }

  if (period === "30d") {
    const buckets = [];
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const from = new Date(cursor);
      const to = new Date(cursor);
      to.setUTCDate(to.getUTCDate() + 6);
      if (to > endDate) to.setTime(endDate.getTime());
      buckets.push({
        key: `${isoDate(from)}-${isoDate(to)}`,
        label: shortRange(from, to),
        from: isoDate(from),
        to: isoDate(to),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return buckets;
  }

  const months = new Map<string, { key: string; label: string; from: string; to: string }>();
  for (const date of eachDate(startDate, endDate)) {
    const key = isoDate(date).slice(0, 7);
    const existing = months.get(key);
    if (existing) existing.to = isoDate(date);
    else months.set(key, {
      key,
      label: new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short" }).format(date),
      from: isoDate(date),
      to: isoDate(date),
    });
  }
  return [...months.values()];
}

function sumType(movements: readonly InventoryMovementRecord[], type: string) {
  return movements.reduce((sum, movement) => movement.type.trim().toLowerCase() === type ? sum + movement.quantity : sum, 0);
}

function eachDate(startDate: Date, endDate: Date) {
  const dates: Date[] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function shortRange(from: Date, to: Date) {
  const format = new Intl.DateTimeFormat("en-PH", { timeZone: "UTC", month: "short", day: "numeric" });
  return from.getTime() === to.getTime() ? format.format(from) : `${format.format(from)}–${format.format(to)}`;
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

