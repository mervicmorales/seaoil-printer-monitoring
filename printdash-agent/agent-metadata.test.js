"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const packageJson = require("./package.json");
const { AGENT_VERSION, getAgentRuntimeMetadata } = require("./agent-metadata");

test("uses package.json as the canonical semantic agent version", () => {
  assert.equal(AGENT_VERSION, packageJson.version);
  assert.match(AGENT_VERSION, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)/);
});

test("reports non-sensitive runtime metadata", () => {
  const metadata = getAgentRuntimeMetadata();
  assert.equal(metadata.version, packageJson.version);
  assert.ok(metadata.hostname);
  assert.ok(metadata.platform);
  assert.ok(metadata.architecture);
  assert.equal(metadata.nodeVersion, process.version);
  assert.ok(Number.isInteger(metadata.agentUptimeSeconds));
  assert.ok(metadata.agentUptimeSeconds >= 0);
  assert.equal("username" in metadata, false);
  assert.equal("token" in metadata, false);
});
