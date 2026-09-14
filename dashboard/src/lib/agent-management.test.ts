import assert from "node:assert/strict";
import test from "node:test";
import {
  agentManagementAuthorizationStatus,
  toPublicAgentDetail,
  type AgentDetail,
} from "./agent-management";

test("Agent Management API policy rejects missing, employee, support, and unpermitted sessions", () => {
  assert.equal(agentManagementAuthorizationStatus(null, false), 401);
  assert.equal(agentManagementAuthorizationStatus({ role: "employee" }, true), 403);
  assert.equal(agentManagementAuthorizationStatus({ role: "support" }, true), 403);
  assert.equal(agentManagementAuthorizationStatus({ role: "admin" }, false), 403);
  assert.equal(agentManagementAuthorizationStatus({ role: "admin" }, true), 200);
  assert.equal(agentManagementAuthorizationStatus({ role: "super_admin" }, true), 200);
});

test("public agent responses never serialize credential or SNMP secrets", () => {
  const detail: AgentDetail & Record<string, unknown> = {
    id: 1,
    name: "Test Agent",
    agentKey: "test-agent",
    location: "Test Office",
    connectivity: "online",
    installedVersion: "1.0.0",
    latestVersion: "1.0.0",
    updateStatus: "up-to-date",
    platform: "win32",
    platformLabel: "Windows",
    architecture: "x64",
    hostname: "TEST-AGENT",
    nodeVersion: "v24.0.0",
    lastSeen: "2026-09-14T00:00:00.000Z",
    lastSuccessfulUploadAt: "2026-09-14T00:00:00.000Z",
    agentUptimeSeconds: 60,
    buildIdentifier: null,
    assignedPrinterCount: 1,
    matchedPrinterCount: 1,
    unmatchedPrinterCount: 0,
    assignedLocations: ["Test Office"],
    tokenHash: "should-never-leak",
    bearerToken: "should-never-leak",
    snmpCommunity: "should-never-leak",
  };
  const serialized = JSON.stringify(toPublicAgentDetail(detail));
  assert.doesNotMatch(serialized, /should-never-leak/);
  assert.doesNotMatch(serialized, /tokenHash|bearerToken|snmpCommunity/);
});
