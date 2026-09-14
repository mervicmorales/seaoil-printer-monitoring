import assert from "node:assert/strict";
import test from "node:test";
import {
  compareSemver,
  getAgentUpdateStatus,
  isAgentOnline,
  parseSemver,
} from "./agent-version";

test("compares semantic versions numerically, including prereleases", () => {
  assert.equal(compareSemver("1.10.0", "1.9.0"), 1);
  assert.equal(compareSemver("1.0.0", "1.0.0"), 0);
  assert.equal(compareSemver("1.0.0-beta.2", "1.0.0-beta.11"), -1);
  assert.equal(compareSemver("1.0.0-rc.1", "1.0.0"), -1);
  assert.equal(compareSemver("1.0.0+build.7", "1.0.0+build.8"), 0);
  assert.equal(parseSemver("1.0.0-01"), null);
  assert.equal(compareSemver("unknown", "1.0.0"), null);
});

test("detects update available, up-to-date, and unknown versions", () => {
  assert.equal(getAgentUpdateStatus("0.9.5", "1.0.0"), "update-available");
  assert.equal(getAgentUpdateStatus("1.0.0", "1.0.0"), "up-to-date");
  assert.equal(getAgentUpdateStatus("1.1.0", "1.0.0"), "up-to-date");
  assert.equal(getAgentUpdateStatus(null, "1.0.0"), "unknown-version");
});

test("uses status, credential state, and last communication for connectivity", () => {
  const now = new Date("2026-09-14T00:10:00.000Z");
  const base = {
    storedStatus: "online",
    tokenRevokedAt: null,
    staleSeconds: 180,
    now,
  };
  assert.equal(isAgentOnline({ ...base, lastSeen: new Date("2026-09-14T00:09:00.000Z") }), true);
  assert.equal(isAgentOnline({ ...base, lastSeen: new Date("2026-09-14T00:06:00.000Z") }), false);
  assert.equal(isAgentOnline({ ...base, storedStatus: "offline", lastSeen: now }), false);
  assert.equal(isAgentOnline({ ...base, tokenRevokedAt: now, lastSeen: now }), false);
  assert.equal(isAgentOnline({ ...base, lastSeen: null }), false);
});
