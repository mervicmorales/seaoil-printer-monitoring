"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  createHealthPayload,
  createShutdownCoordinator,
  formatListenError,
  getRuntimeSettings,
  redactLogValue,
  resolveRuntimePath,
  validateServiceStartup,
} = require("./service-runtime");

test("resolves Windows service paths without affecting other platforms", () => {
  assert.equal(
    resolveRuntimePath("data\\printers.json", "C:\\ProgramData\\SEAOIL\\PrinterAgent", "win32"),
    "C:\\ProgramData\\SEAOIL\\PrinterAgent\\data\\printers.json",
  );
  assert.equal(
    resolveRuntimePath("/var/lib/printdash/printers.json", "/app", "linux"),
    "/var/lib/printdash/printers.json",
  );
});

test("binds locally by default and reads explicit service configuration", () => {
  assert.deepEqual(getRuntimeSettings({}), {
    port: 3003,
    portIsValid: true,
    bindAddress: "127.0.0.1",
    environmentFile: null,
    serviceMode: false,
  });
  const configured = getRuntimeSettings({ PORT: "3100", PRINTDASH_LISTEN_ADDRESS: "0.0.0.0" });
  assert.equal(configured.port, 3100);
  assert.equal(configured.bindAddress, "0.0.0.0");
});

test("validates critical Windows service configuration", () => {
  const environment = {
    SEAOIL_SERVICE_MODE: "windows-service",
    SEAOIL_ENV_FILE: "C:\\ProgramData\\SEAOIL\\PrinterAgent\\config\\agent.env",
    SEAOIL_API_URL: "https://monitoring.example.test/api/monitoring/ingest",
    SEAOIL_AGENT_TOKEN: "test-only-token-value",
    USERS_FILE: "C:\\ProgramData\\SEAOIL\\PrinterAgent\\data\\users.json",
    PRINTDASH_ADMIN_PASSWORD: "long-admin-password",
    PRINTDASH_USER_PASSWORD: "long-user-password",
  };
  const result = validateServiceStartup({
    environment,
    settings: getRuntimeSettings(environment),
    agentConfig: { errors: [] },
    fileExists: file => file.endsWith("agent.env"),
    nodeVersion: "24.10.0",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("rejects missing service credentials and invalid ports without exposing values", () => {
  const environment = { SEAOIL_SERVICE_MODE: "windows-service", PORT: "invalid" };
  const result = validateServiceStartup({
    environment,
    settings: getRuntimeSettings(environment),
    agentConfig: { errors: ["SEAOIL_AGENT_TOKEN is required", "SEAOIL_AGENT_KEY is required"] },
    fileExists: () => false,
    nodeVersion: "26.5.0",
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /PORT must be an integer/);
  assert.match(result.errors.join("; "), /SEAOIL_AGENT_TOKEN is required/);
  assert.match(result.warnings.join("; "), /Node\.js 24 LTS/);
});

test("rejects unchanged example secrets in service mode", () => {
  const environment = {
    SEAOIL_SERVICE_MODE: "windows-service",
    SEAOIL_ENV_FILE: "C:\\ProgramData\\SEAOIL\\PrinterAgent\\config\\agent.env",
    SEAOIL_API_URL: "https://monitoring.example.com/api/monitoring/ingest",
    SEAOIL_AGENT_TOKEN: "replace-with-a-long-random-token",
    SEAOIL_SNMP_COMMUNITY: "replace-with-office-snmp-community",
    USERS_FILE: "C:\\ProgramData\\SEAOIL\\PrinterAgent\\data\\users.json",
    PRINTDASH_ADMIN_PASSWORD: "replace-with-a-secure-admin-password",
    PRINTDASH_USER_PASSWORD: "replace-with-a-secure-user-password",
  };
  const result = validateServiceStartup({
    environment,
    settings: getRuntimeSettings(environment),
    agentConfig: { errors: [] },
    fileExists: file => file.endsWith("agent.env"),
    nodeVersion: "24.10.0",
  });
  assert.equal(result.ok, false);
  assert.match(result.errors.join("; "), /example/);
  assert.match(result.errors.join("; "), /SEAOIL_AGENT_TOKEN/);
  assert.match(result.errors.join("; "), /SEAOIL_SNMP_COMMUNITY/);
  assert.match(result.errors.join("; "), /PRINTDASH_ADMIN_PASSWORD/);
});

test("redacts credentials from unexpected error text", () => {
  const environment = {
    SEAOIL_AGENT_TOKEN: "agent-secret-value",
    SEAOIL_SNMP_COMMUNITY: "private-community",
  };
  const output = redactLogValue(
    "Authorization: Bearer agent-secret-value community=private-community",
    environment,
  );
  assert.equal(output.includes("agent-secret-value"), false);
  assert.equal(output.includes("private-community"), false);
  assert.match(output, /\[REDACTED\]/);
});

test("returns a useful EADDRINUSE message", () => {
  assert.equal(
    formatListenError({ code: "EADDRINUSE" }, 3003),
    "SEAOIL Agent cannot start because port 3003 is already in use. Another SEAOIL Agent instance may already be running.",
  );
});

test("creates a non-sensitive health response", () => {
  assert.deepEqual(createHealthPayload({ startedAt: 1_000, now: 4_500, version: "4.0.0" }), {
    status: "ok",
    version: "4.0.0",
    uptimeSeconds: 3,
  });
});

test("runs graceful shutdown cleanup once and in order", async () => {
  const calls = [];
  const logger = { log: message => calls.push(message), error: message => calls.push(message) };
  let exitCode = null;
  const coordinator = createShutdownCoordinator({
    logger,
    steps: [async () => { calls.push("timers"); }, async () => { calls.push("requests"); }],
    setExitCode: code => { exitCode = code; },
  });
  await Promise.all([
    coordinator.shutdown("SIGTERM", 0),
    coordinator.shutdown("SIGINT", 1),
  ]);
  assert.equal(exitCode, 0);
  assert.deepEqual(calls.filter(call => call === "timers" || call === "requests"), ["timers", "requests"]);
  assert.equal(coordinator.isShuttingDown(), true);
});

test("keeps secrets out of the WinSW service definition", () => {
  const xml = fs.readFileSync(
    path.join(__dirname, "windows", "service", "SEAOILPrinterAgent.xml"),
    "utf8",
  );
  assert.match(xml, /<id>SEAOILPrinterAgent<\/id>/);
  assert.match(xml, /<startmode>Automatic<\/startmode>/);
  assert.match(xml, /<onfailure action="restart" delay="60 sec" \/>/);
  assert.match(xml, /<sizeThreshold>10240<\/sizeThreshold>/);
  assert.equal(xml.includes("SEAOIL_AGENT_TOKEN"), false);
  assert.equal(xml.includes("SEAOIL_SNMP_COMMUNITY"), false);
  assert.equal(xml.includes("PASSWORD"), false);
});
