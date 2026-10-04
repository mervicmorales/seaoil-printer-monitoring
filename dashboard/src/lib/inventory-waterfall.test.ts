import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { buildInventoryWaterfall } from "./inventory-waterfall.ts";

test("builds daily week movements from the current inventory balance", () => {
  const result = buildInventoryWaterfall(12, "2026-10-01", "7d", [
    { date: "2026-09-26", type: "Delivery", quantity: 10 },
    { date: "2026-09-28", type: "Request", quantity: 3 },
    { date: "2026-10-01", type: "Request", quantity: 2 },
  ]);

  assert.equal(result.startingStock, 7);
  assert.equal(result.delivered, 10);
  assert.equal(result.requested, 5);
  assert.equal(result.endingStock, 12);
  assert.equal(result.steps[0]?.kind, "start");
  assert.equal(result.steps.at(-1)?.kind, "end");
  assert.deepEqual(result.steps.filter((step) => step.delta !== 0).map((step) => step.delta), [7, 10, -3, -2, 12]);
});

test("groups quarter movements by calendar month", () => {
  const result = buildInventoryWaterfall(25, "2026-10-01", "90d", [
    { date: "2026-07-10", type: "Delivery", quantity: 8 },
    { date: "2026-08-12", type: "Request", quantity: 4 },
    { date: "2026-09-20", type: "Request", quantity: 3 },
  ]);

  assert.deepEqual(result.steps.slice(1, -1).map((step) => step.label), ["Jul", "Aug", "Sep", "Oct"]);
  assert.equal(result.startingStock, 24);
});

test("groups a year by month and isolates requests for a highlighted department", () => {
  const result = buildInventoryWaterfall(50, "2026-10-04", "12m", [
    { date: "2025-10-02", type: "Delivery", quantity: 20 },
    { date: "2026-02-12", type: "Request", quantity: 4, departmentKey: "7" },
    { date: "2026-02-14", type: "Request", quantity: 3, departmentKey: "8" },
    { date: "2026-09-20", type: "Request", quantity: 2, departmentKey: "7" },
  ], { dimension: "department", key: "7" });

  assert.equal(result.steps.slice(1, -1).length, 13);
  assert.equal(result.highlightedRequested, 6);
  assert.equal(result.steps.find((step) => step.key === "2026-02")?.highlightedRequests, 4);
  assert.equal(result.steps.find((step) => step.key === "2026-09")?.highlightedRequests, 2);
});

test("isolates requests for a highlighted office", () => {
  const result = buildInventoryWaterfall(20, "2026-10-04", "30d", [
    { date: "2026-09-12", type: "Request", quantity: 5, departmentKey: "7", officeKey: "2" },
    { date: "2026-09-14", type: "Request", quantity: 3, departmentKey: "7", officeKey: "3" },
    { date: "2026-09-20", type: "Delivery", quantity: 8, officeKey: "2" },
  ], { dimension: "office", key: "2" });

  assert.equal(result.highlightedRequested, 5);
  assert.equal(result.steps.reduce((sum, step) => sum + step.highlightedRequests, 0), 5);
});

test("isolates requests for a highlighted toner type", () => {
  const result = buildInventoryWaterfall(20, "2026-10-04", "30d", [
    { date: "2026-09-12", type: "Request", quantity: 5, tonerKey: "2" },
    { date: "2026-09-14", type: "Request", quantity: 3, tonerKey: "3" },
    { date: "2026-09-20", type: "Delivery", quantity: 8, tonerKey: "2" },
  ], { dimension: "toner", key: "2" });

  assert.equal(result.highlightedRequested, 5);
  assert.equal(result.steps.reduce((sum, step) => sum + step.highlightedRequests, 0), 5);
});
