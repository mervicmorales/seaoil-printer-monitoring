import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { mergeRecentScanDevices, normalizePrintOpsSnapshot } from "./printops.ts";

test("retains a recently confirmed scanner missing from the latest snapshot", () => {
  const latest = normalizePrintOpsSnapshot({
    scanDevices: [{ id: "escl:49", printerId: 49, label: "Current", sources: ["Flatbed"] }],
  });
  const previous = normalizePrintOpsSnapshot({
    scanDevices: [
      { id: "escl:49", printerId: 49, label: "Older", sources: ["Flatbed"] },
      { id: "escl:43", printerId: 43, label: "Sleeping printer", sources: ["Flatbed", "ADF"] },
    ],
  });

  assert.deepEqual(mergeRecentScanDevices([latest, previous]), [
    { id: "escl:49", printerId: 49, label: "Current", sources: ["Flatbed"] },
    { id: "escl:43", printerId: 43, label: "Sleeping printer", sources: ["Flatbed", "ADF"] },
  ]);
});
