import assert from "node:assert/strict";
import test from "node:test";
import {
  databaseSizeLabel,
  nextRetentionRun,
  retentionDisplayConfig,
  retentionHealth,
} from "./monitoring-retention-display";

test("builds the default retention display configuration", () => {
  assert.deepEqual(retentionDisplayConfig({}), {
    enabled: true,
    rawRetentionDays: 30,
    summaryRetentionDays: 730,
    resolvedAlertRetentionDays: 365,
    scheduleHour: 2,
    scheduleMinute: 30,
    timezone: "Asia/Manila",
  });
});

test("calculates the next Manila cleanup schedule", () => {
  const config = retentionDisplayConfig({});
  assert.equal(
    nextRetentionRun(new Date("2026-10-07T18:00:00.000Z"), config)?.toISOString(),
    "2026-10-07T18:30:00.000Z",
  );
  assert.equal(
    nextRetentionRun(new Date("2026-10-07T19:00:00.000Z"), config)?.toISOString(),
    "2026-10-08T18:30:00.000Z",
  );
});

test("describes retention health from the latest run", () => {
  const now = new Date("2026-10-07T12:00:00.000Z");
  assert.equal(retentionHealth(false, null, null, now), "disabled");
  assert.equal(retentionHealth(true, "running", null, now), "running");
  assert.equal(retentionHealth(true, "failed", null, now), "failed");
  assert.equal(
    retentionHealth(true, "completed", new Date("2026-10-07T00:00:00.000Z"), now),
    "healthy",
  );
  assert.equal(
    retentionHealth(true, "completed", new Date("2026-10-05T00:00:00.000Z"), now),
    "waiting",
  );
});

test("formats database byte counts", () => {
  assert.equal(databaseSizeLabel(173_586_099), "166 MB");
  assert.equal(databaseSizeLabel(6_442_450_944), "6.00 GB");
});
