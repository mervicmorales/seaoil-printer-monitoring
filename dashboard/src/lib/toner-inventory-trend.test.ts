import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { buildStockTrend } from "./toner-inventory-trend.ts";

test("reconstructs daily stock from delivered and request transactions while ignoring purchases", () => {
  const days = ["2026-09-29", "2026-09-30", "2026-10-01"];
  const trend = buildStockTrend(8, days, [
    { date: "2026-09-29", type: "Purchase", quantity: 20 },
    { date: "2026-09-29", type: "Delivered", quantity: 10 },
    { date: "2026-09-30", type: "Request", quantity: 3 },
    { date: "2026-10-01", type: "Request", quantity: 2 },
  ]);

  assert.deepEqual(trend, [13, 10, 8]);
});

test("ends at current stock and ignores movements outside the displayed period", () => {
  const days = ["2026-09-30", "2026-10-01"];
  const trend = buildStockTrend(4, days, [
    { date: "2026-09-01", type: "Delivery", quantity: 20 },
    { date: "2026-10-01", type: "Request", quantity: 2 },
  ]);

  assert.deepEqual(trend, [6, 4]);
});
