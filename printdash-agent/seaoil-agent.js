"use strict";

const serviceEnvironmentFile = process.env.SEAOIL_ENV_FILE?.trim();
require("dotenv").config({
  quiet: true,
  ...(serviceEnvironmentFile ? { path: serviceEnvironmentFile } : {}),
});

const net = require("net");
const fs = require("fs");
const path = require("path");
const { AGENT_VERSION, getAgentRuntimeMetadata } = require("./agent-metadata");
const { normalizeMacAddress } = require("./mac-address");

const DEFAULT_API_URL = "http://localhost:3000/api/monitoring/ingest";
const DEFAULT_POLL_INTERVAL_SECONDS = 60;
const MIN_POLL_INTERVAL_SECONDS = 30;
const MAX_POLL_INTERVAL_SECONDS = 3600;
const DEFAULT_CONFIG_REFRESH_SECONDS = 60;
const MIN_CONFIG_REFRESH_SECONDS = 30;
const MAX_CONFIG_REFRESH_SECONDS = 3600;
const API_TIMEOUT_MS = 10_000;
const activeRequestControllers = new Set();

function createRequestController() {
  const controller = new AbortController();
  activeRequestControllers.add(controller);
  return controller;
}

function releaseRequestController(controller) {
  activeRequestControllers.delete(controller);
}

function abortActiveAgentRequests() {
  for (const controller of activeRequestControllers) controller.abort();
  activeRequestControllers.clear();
}

async function discardResponseBody(response) {
  if (!response.body) return;
  try {
    await response.body.cancel();
  } catch {
    // The body may already be closed after an abort or network failure.
  }
}

function optionalEnvironmentValue(name) {
  const value = process.env[name]?.trim();
  return value || null;
}

function parsePollInterval(value) {
  if (value === undefined || value.trim() === "") {
    return { value: DEFAULT_POLL_INTERVAL_SECONDS, warning: null };
  }

  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_POLL_INTERVAL_SECONDS ||
    parsed > MAX_POLL_INTERVAL_SECONDS
  ) {
    return {
      value: DEFAULT_POLL_INTERVAL_SECONDS,
      warning: `POLL_INTERVAL_SECONDS must be an integer from ${MIN_POLL_INTERVAL_SECONDS} to ${MAX_POLL_INTERVAL_SECONDS}; using ${DEFAULT_POLL_INTERVAL_SECONDS}s`,
    };
  }
  return { value: parsed, warning: null };
}

function validateApiUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return { value, error: "SEAOIL_API_URL must use http:// or https://" };
    }
    if (url.username || url.password) {
      return { value, error: "SEAOIL_API_URL must not contain credentials" };
    }
    return {
      value: url.toString(),
      displayValue: url.origin + url.pathname,
      error: null,
    };
  } catch {
    return { value, error: "SEAOIL_API_URL is not a valid URL" };
  }
}

function deriveConfigUrl(ingestUrl) {
  try {
    const url = new URL(ingestUrl);
    url.pathname = url.pathname.replace(/\/ingest\/?$/, "/config");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return ingestUrl;
  }
}

function deriveDiscoveryUrl(ingestUrl) {
  try {
    const url = new URL(ingestUrl);
    url.pathname = url.pathname.replace(/\/ingest\/?$/, "/discovery");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return ingestUrl;
  }
}

function derivePrintOpsUrl(ingestUrl) {
  try {
    const url = new URL(ingestUrl);
    url.pathname = url.pathname.replace(/\/ingest\/?$/, "/printops");
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return ingestUrl;
  }
}

function parseConfigRefreshInterval(value) {
  if (value === undefined || value.trim() === "") {
    return { value: DEFAULT_CONFIG_REFRESH_SECONDS, warning: null };
  }
  const parsed = Number(value);
  if (
    !Number.isInteger(parsed) ||
    parsed < MIN_CONFIG_REFRESH_SECONDS ||
    parsed > MAX_CONFIG_REFRESH_SECONDS
  ) {
    return {
      value: DEFAULT_CONFIG_REFRESH_SECONDS,
      warning: `SEAOIL_CONFIG_REFRESH_SECONDS must be an integer from ${MIN_CONFIG_REFRESH_SECONDS} to ${MAX_CONFIG_REFRESH_SECONDS}; using ${DEFAULT_CONFIG_REFRESH_SECONDS}s`,
    };
  }
  return { value: parsed, warning: null };
}

function validateAgentKey(value) {
  if (!value) return "SEAOIL_AGENT_KEY is required";
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/.test(value)) {
    return "SEAOIL_AGENT_KEY must be 1-100 letters, numbers, dots, underscores, colons, or hyphens";
  }
  return null;
}

const pollInterval = parsePollInterval(process.env.POLL_INTERVAL_SECONDS);
const apiUrl = validateApiUrl(
  optionalEnvironmentValue("SEAOIL_API_URL") || DEFAULT_API_URL,
);
const configUrl = validateApiUrl(
  optionalEnvironmentValue("SEAOIL_CONFIG_URL") || deriveConfigUrl(apiUrl.value),
);
const discoveryUrl = validateApiUrl(deriveDiscoveryUrl(apiUrl.value));
const printOpsUrl = validateApiUrl(derivePrintOpsUrl(apiUrl.value));
const configRefresh = parseConfigRefreshInterval(
  process.env.SEAOIL_CONFIG_REFRESH_SECONDS,
);
const token = optionalEnvironmentValue("SEAOIL_AGENT_TOKEN");
const agentKey = optionalEnvironmentValue("SEAOIL_AGENT_KEY");
const configurationErrors = [
  apiUrl.error,
  configUrl.error,
  token ? null : "SEAOIL_AGENT_TOKEN is required",
  validateAgentKey(agentKey),
].filter(Boolean);

const agentConfig = Object.freeze({
  apiUrl: apiUrl.value,
  apiDisplayUrl: apiUrl.displayValue || apiUrl.value,
  configUrl: configUrl.value,
  configDisplayUrl: configUrl.displayValue || configUrl.value,
  discoveryUrl: discoveryUrl.value,
  printOpsUrl: printOpsUrl.value,
  token,
  agentKey,
  agentName: optionalEnvironmentValue("SEAOIL_AGENT_NAME") || "PrintDash Agent",
  agentLocation: optionalEnvironmentValue("SEAOIL_AGENT_LOCATION"),
  version: AGENT_VERSION,
  pollIntervalSeconds: pollInterval.value,
  pollIntervalMs: pollInterval.value * 1000,
  configRefreshSeconds: configRefresh.value,
  configRefreshMs: configRefresh.value * 1000,
  snmpCommunity: optionalEnvironmentValue("SEAOIL_SNMP_COMMUNITY") || "public",
  configCacheFile:
    optionalEnvironmentValue("SEAOIL_CONFIG_CACHE_FILE") ||
    path.join(
      path.dirname(optionalEnvironmentValue("DATA_FILE") || "./printers.json"),
      "seaoil-config-cache.json",
    ),
  apiTimeoutMs: API_TIMEOUT_MS,
  warnings: [pollInterval.warning, configRefresh.warning].filter(Boolean),
  errors: configurationErrors,
});

let configurationErrorLogged = false;

function logAgentStartup() {
  console.log("  SEAOIL Agent Name -> " + agentConfig.agentName);
  console.log("  Agent Key         -> " + (agentConfig.agentKey || "NOT CONFIGURED"));
  console.log("  Agent Version     -> " + agentConfig.version);
  console.log("  Central API URL    -> " + agentConfig.apiDisplayUrl);
  console.log("  Config API URL     -> " + agentConfig.configDisplayUrl);
  console.log("  Poll Interval      -> " + agentConfig.pollIntervalSeconds + "s");
  console.log("  Config Refresh     -> " + agentConfig.configRefreshSeconds + "s");
  if (agentConfig.agentLocation) {
    console.log("  Agent Office       -> " + agentConfig.agentLocation);
  }
  for (const warning of agentConfig.warnings) {
    console.warn("[SEAOIL Agent] Configuration warning: " + warning);
  }
  if (agentConfig.errors.length > 0) {
    console.error(
      "[SEAOIL Agent] Central upload disabled: " + agentConfig.errors.join("; "),
    );
    configurationErrorLogged = true;
  }
}

function normalizeConfigTargets(value) {
  if (!value || value.success !== true || !Array.isArray(value.printers)) {
    return { ok: false, error: "invalid response shape" };
  }

  const targets = [];
  const seenIds = new Set();
  const seenIps = new Set();
  let skipped = 0;

  for (const candidate of value.printers) {
    const id = Number(candidate?.id);
    const name = typeof candidate?.name === "string" ? candidate.name.trim() : "";
    const ip = typeof candidate?.ip === "string" ? candidate.ip.trim() : "";
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !name ||
      name.length > 255 ||
      net.isIP(ip) === 0 ||
      seenIds.has(id) ||
      seenIps.has(ip)
    ) {
      skipped += 1;
      continue;
    }

    seenIds.add(id);
    seenIps.add(ip);
    targets.push({
      id,
      name,
      ip,
      location:
        typeof candidate.location === "string" ? candidate.location.trim() : "",
      serial:
        typeof candidate.serial === "string" ? candidate.serial.trim() : null,
      model: typeof candidate.model === "string" ? candidate.model.trim() : null,
      community: agentConfig.snmpCommunity,
      centrallyManaged: true,
    });
  }

  return { ok: true, targets, skipped };
}

function loadCachedMonitoringConfig() {
  try {
    if (!fs.existsSync(agentConfig.configCacheFile)) {
      return { ok: false, reason: "missing" };
    }
    const normalized = normalizeConfigTargets(
      JSON.parse(fs.readFileSync(agentConfig.configCacheFile, "utf8")),
    );
    if (!normalized.ok) {
      console.warn(
        "[SEAOIL Agent] Ignoring invalid cached central configuration.",
      );
      return { ok: false, reason: "invalid" };
    }
    return normalized;
  } catch {
    console.warn("[SEAOIL Agent] Could not read cached central configuration.");
    return { ok: false, reason: "read-error" };
  }
}

function saveCachedMonitoringConfig(targets) {
  const cacheValue = {
    success: true,
    savedAt: new Date().toISOString(),
    printers: targets.map((target) => ({
      id: target.id,
      name: target.name,
      ip: target.ip,
      serial: target.serial,
      model: target.model,
      location: target.location,
    })),
  };
  const temporaryFile = `${agentConfig.configCacheFile}.tmp`;
  try {
    fs.mkdirSync(path.dirname(agentConfig.configCacheFile), { recursive: true });
    fs.writeFileSync(temporaryFile, JSON.stringify(cacheValue, null, 2), {
      mode: 0o600,
    });
    fs.renameSync(temporaryFile, agentConfig.configCacheFile);
    return true;
  } catch {
    try {
      if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
    } catch {}
    console.warn(
      "[SEAOIL Agent] Could not persist the central configuration cache; the in-memory list remains active.",
    );
    return false;
  }
}

async function fetchMonitoringConfig() {
  if (agentConfig.errors.length > 0) {
    return { ok: false, reason: "configuration" };
  }

  const controller = createRequestController();
  const timeout = setTimeout(() => controller.abort(), agentConfig.apiTimeoutMs);
  try {
    const response = await fetch(agentConfig.configUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${agentConfig.token}`,
        "X-SEAOIL-Agent-Key": agentConfig.agentKey,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      await discardResponseBody(response);
      console.error(
        `[SEAOIL Agent] Configuration sync failed: central API returned HTTP ${response.status}. Keeping the last known printer list.`,
      );
      return { ok: false, reason: "http", status: response.status };
    }

    const normalized = normalizeConfigTargets(await response.json().catch(() => null));
    if (!normalized.ok) {
      console.error(
        "[SEAOIL Agent] Configuration sync returned invalid data. Keeping the last known printer list.",
      );
      return { ok: false, reason: "invalid-response" };
    }
    if (normalized.skipped > 0) {
      console.warn(
        `[SEAOIL Agent] Ignored ${normalized.skipped} invalid or duplicate configured target(s).`,
      );
    }
    return normalized;
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error(
      timedOut
        ? `[SEAOIL Agent] Configuration sync timed out after ${agentConfig.apiTimeoutMs / 1000}s. Keeping the last known printer list.`
        : "[SEAOIL Agent] Configuration API is unreachable. Keeping the last known printer list.",
    );
    return { ok: false, reason: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(timeout);
    releaseRequestController(controller);
  }
}

function safePrinterPayload(printer) {
  return {
    name: printer.name,
    ip: printer.ip,
    online: printer.online,
    status: printer.status,
    model: printer.model,
    serial: printer.serial,
    macAddress: normalizeMacAddress(printer.mac),
    pages: printer.pages,
    uptime: printer.uptime,
    uptimeSeconds: printer.uptimeSec,
    toners: printer.toners,
    trays: printer.trays,
    alerts: printer.alerts,
    lastChecked: printer.lastChecked,
  };
}

async function sendToSeaoil(printers) {
  if (agentConfig.errors.length > 0) {
    if (!configurationErrorLogged) {
      console.error(
        "[SEAOIL Agent] Upload skipped: " + agentConfig.errors.join("; "),
      );
      configurationErrorLogged = true;
    }
    return { ok: false, reason: "configuration" };
  }

  const payload = {
    agent: {
      key: agentConfig.agentKey,
      name: agentConfig.agentName,
      ...getAgentRuntimeMetadata(),
      ...(agentConfig.agentLocation
        ? { location: agentConfig.agentLocation }
        : {}),
    },
    sentAt: new Date().toISOString(),
    printers: printers.map(safePrinterPayload),
  };

  const controller = createRequestController();
  const timeout = setTimeout(() => controller.abort(), agentConfig.apiTimeoutMs);

  try {
    const response = await fetch(agentConfig.apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentConfig.token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      await discardResponseBody(response);
      console.error(
        `[SEAOIL Agent] Upload failed: central API returned HTTP ${response.status}. Local monitoring continues; retrying next poll.`,
      );
      return { ok: false, reason: "http", status: response.status };
    }

    const result = await response.json().catch(() => null);
    const matched = Array.isArray(result?.matched) ? result.matched.length : null;
    const unmatched = Array.isArray(result?.unmatched) ? result.unmatched.length : null;
    const details =
      matched === null
        ? ""
        : ` (${matched} matched, ${unmatched ?? 0} unmatched)`;
    console.log(
      `[SEAOIL Agent] Uploaded ${printers.length} printer(s)${details}.`,
    );
    return { ok: true, status: response.status, matched, unmatched };
  } catch (error) {
    const timedOut = error?.name === "AbortError";
    console.error(
      timedOut
        ? `[SEAOIL Agent] Upload timed out after ${agentConfig.apiTimeoutMs / 1000}s. Local monitoring continues; retrying next poll.`
        : "[SEAOIL Agent] Central API is unreachable. Local monitoring continues; retrying next poll.",
    );
    return { ok: false, reason: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(timeout);
    releaseRequestController(controller);
  }
}

let lastDiscoveryEndpointError = null;

function logDiscoveryEndpointError(message) {
  if (lastDiscoveryEndpointError === message) return;
  lastDiscoveryEndpointError = message;
  console.error(`[SEAOIL Agent] Discovery API error: ${message}`);
}

async function fetchDiscoveryJob() {
  if (agentConfig.errors.length > 0) return null;
  const controller = createRequestController();
  const timeout = setTimeout(() => controller.abort(), agentConfig.apiTimeoutMs);
  try {
    const response = await fetch(agentConfig.discoveryUrl, {
      headers: {
        Authorization: `Bearer ${agentConfig.token}`,
        "X-SEAOIL-Agent-Key": agentConfig.agentKey,
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok) {
      await discardResponseBody(response);
      logDiscoveryEndpointError(`central API returned HTTP ${response.status}`);
      return null;
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      await discardResponseBody(response);
      logDiscoveryEndpointError("central API returned a non-JSON response");
      return null;
    }
    const body = await response.json().catch(() => null);
    lastDiscoveryEndpointError = null;
    return body?.job && Number.isSafeInteger(body.job.id) && typeof body.job.subnet === "string"
      ? body.job
      : null;
  } catch (error) {
    logDiscoveryEndpointError(error?.name === "AbortError" ? "request timed out" : "central API is unreachable");
    return null;
  } finally {
    clearTimeout(timeout);
    releaseRequestController(controller);
  }
}

async function completeDiscoveryJob(jobId, results, error) {
  if (agentConfig.errors.length > 0) return false;
  const controller = createRequestController();
  const timeout = setTimeout(() => controller.abort(), agentConfig.apiTimeoutMs);
  try {
    const response = await fetch(agentConfig.discoveryUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentConfig.token}`,
        "X-SEAOIL-Agent-Key": agentConfig.agentKey,
      },
      body: JSON.stringify(error ? { jobId, error } : { jobId, results }),
      signal: controller.signal,
    });
    const ok = response.ok;
    await discardResponseBody(response);
    return ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    releaseRequestController(controller);
  }
}

let lastPrintOpsEndpointError = null;

function logPrintOpsEndpointError(message) {
  if (lastPrintOpsEndpointError === message) return;
  lastPrintOpsEndpointError = message;
  console.error(`[SEAOIL Agent] PrintOps API error: ${message}`);
}

async function fetchPrintOpsCommand() {
  if (agentConfig.errors.length > 0) return null;
  const controller = createRequestController();
  const timeout = setTimeout(() => controller.abort(), agentConfig.apiTimeoutMs);
  try {
    const response = await fetch(agentConfig.printOpsUrl, {
      headers: {
        Authorization: `Bearer ${agentConfig.token}`,
        "X-SEAOIL-Agent-Key": agentConfig.agentKey,
      },
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok) {
      await discardResponseBody(response);
      logPrintOpsEndpointError(`central API returned HTTP ${response.status}`);
      return null;
    }
    if (!response.headers.get("content-type")?.includes("application/json")) {
      await discardResponseBody(response);
      logPrintOpsEndpointError("central API returned a non-JSON response");
      return null;
    }
    const body = await response.json().catch(() => null);
    lastPrintOpsEndpointError = null;
    return body?.command && Number.isSafeInteger(body.command.id)
      ? body.command
      : null;
  } catch (error) {
    logPrintOpsEndpointError(
      error?.name === "AbortError" ? "request timed out" : "central API is unreachable",
    );
    return null;
  } finally {
    clearTimeout(timeout);
    releaseRequestController(controller);
  }
}

async function completePrintOpsCommand(commandId, result, output, error) {
  if (agentConfig.errors.length > 0) return false;
  const controller = createRequestController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const body = error
      ? { commandId, error }
      : { commandId, result, ...(output ? { output } : {}) };
    const response = await fetch(agentConfig.printOpsUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${agentConfig.token}`,
        "X-SEAOIL-Agent-Key": agentConfig.agentKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const ok = response.ok;
    await discardResponseBody(response);
    return ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
    releaseRequestController(controller);
  }
}

module.exports = {
  abortActiveAgentRequests,
  agentConfig,
  completeDiscoveryJob,
  completePrintOpsCommand,
  fetchDiscoveryJob,
  fetchPrintOpsCommand,
  fetchMonitoringConfig,
  loadCachedMonitoringConfig,
  logAgentStartup,
  normalizeConfigTargets,
  saveCachedMonitoringConfig,
  sendToSeaoil,
};
