"use strict";

const os = require("os");
const { version: packageVersion } = require("./package.json");

const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

if (!SEMVER_PATTERN.test(packageVersion)) {
  throw new Error("printdash-agent package.json version must use Semantic Versioning");
}

const AGENT_VERSION = packageVersion;

function optionalBuildIdentifier() {
  const value = process.env.SEAOIL_AGENT_BUILD_ID?.trim();
  return value ? value.slice(0, 255) : null;
}

function getAgentRuntimeMetadata() {
  const buildIdentifier = optionalBuildIdentifier();
  return {
    hostname: os.hostname(),
    version: AGENT_VERSION,
    platform: os.platform(),
    architecture: os.arch(),
    nodeVersion: process.version,
    agentUptimeSeconds: Math.max(0, Math.floor(process.uptime())),
    ...(buildIdentifier ? { buildIdentifier } : {}),
  };
}

module.exports = {
  AGENT_VERSION,
  getAgentRuntimeMetadata,
};
