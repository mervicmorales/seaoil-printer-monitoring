import assert from "node:assert/strict";
import test from "node:test";
import {
  nextScheduledRun,
  retentionConfig,
  retentionEnabled,
} from "./monitoring-retention-config.mjs";

test("uses production-safe retention defaults", () => {
  assert.deepEqual(retentionConfig({}), {
    rawRetentionDays: 30,
    summaryRetentionDays: 730,
    resolvedAlertRetentionDays: 365,
    deleteBatchSize: 10_000,
    scheduleHour: 2,
    scheduleMinute: 30,
    timezone: "Asia/Manila",
  });
});

test("rejects retention values outside the supported range", () => {
  assert.throws(
    () => retentionConfig({ MONITORING_RAW_RETENTION_DAYS: "0" }),
    /Expected an integer from 1 to 3650/,
  );
});

test("retention worker is enabled by default and accepts explicit false", () => {
  assert.equal(retentionEnabled({}), true);
  assert.equal(retentionEnabled({ MONITORING_RETENTION_ENABLED: "true" }), true);
  assert.equal(retentionEnabled({ MONITORING_RETENTION_ENABLED: "false" }), false);
});

test("calculates the next 02:30 Asia/Manila run", () => {
  const beforeSchedule = new Date("2026-10-07T18:00:00.000Z");
  const afterSchedule = new Date("2026-10-07T19:00:00.000Z");
  const config = retentionConfig({});

  assert.equal(
    nextScheduledRun(beforeSchedule, config).toISOString(),
    "2026-10-07T18:30:00.000Z",
  );
  assert.equal(
    nextScheduledRun(afterSchedule, config).toISOString(),
    "2026-10-08T18:30:00.000Z",
  );
});
