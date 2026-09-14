"use strict";

const fs = require("fs");
const path = require("path");
const { AGENT_VERSION } = require("./agent-metadata");

const DEFAULT_PORT = 3003;
const SERVICE_MODE = "windows-service";
const SECRET_ENVIRONMENT_NAMES = [
  "SEAOIL_AGENT_TOKEN",
  "SEAOIL_SNMP_COMMUNITY",
  "PRINTDASH_ADMIN_PASSWORD",
  "PRINTDASH_USER_PASSWORD",
  "TELEGRAM_BOT_TOKEN",
];

function parsePort(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
    ? { port: parsed, valid: true }
    : { port: DEFAULT_PORT, valid: value === undefined || value === "" };
}

function getRuntimeSettings(environment = process.env) {
  const configuredPort = environment.PORT ?? environment.PRINTDASH_PORT;
  const parsedPort = parsePort(configuredPort);
  return {
    port: parsedPort.port,
    portIsValid: parsedPort.valid,
    bindAddress: environment.PRINTDASH_LISTEN_ADDRESS?.trim() || "0.0.0.0",
    environmentFile: environment.SEAOIL_ENV_FILE?.trim() || null,
    serviceMode: environment.SEAOIL_SERVICE_MODE?.trim() === SERVICE_MODE,
  };
}

function resolveRuntimePath(value, workingDirectory = process.cwd(), platform = process.platform) {
  const pathApi = platform === "win32" ? path.win32 : path.posix;
  if (!value) return null;
  return pathApi.isAbsolute(value) ? pathApi.normalize(value) : pathApi.resolve(workingDirectory, value);
}

function isPlaceholder(value) {
  return /^replace-with-/i.test(String(value || "").trim());
}

function validateServiceStartup({
  environment = process.env,
  settings = getRuntimeSettings(environment),
  agentConfig,
  environmentLoadError = null,
  fileExists = fs.existsSync,
  nodeVersion = process.versions.node,
} = {}) {
  if (!settings.serviceMode) return { ok: true, errors: [], warnings: [] };

  const errors = [];
  const warnings = [];
  if (!settings.portIsValid) errors.push("PORT must be an integer from 1 to 65535");
  if (!settings.environmentFile) {
    errors.push("SEAOIL_ENV_FILE must point to the protected service configuration file");
  } else if (environmentLoadError || !fileExists(settings.environmentFile)) {
    errors.push(`Service configuration file is not readable: ${settings.environmentFile}`);
  }
  if (!environment.SEAOIL_API_URL?.trim()) {
    errors.push("SEAOIL_API_URL must be configured for Windows service mode");
  } else if (/monitoring\.example\.com/i.test(environment.SEAOIL_API_URL)) {
    errors.push("SEAOIL_API_URL must be changed from the example URL");
  }
  for (const error of agentConfig?.errors || []) errors.push(error);
  if (isPlaceholder(environment.SEAOIL_AGENT_TOKEN)) {
    errors.push("SEAOIL_AGENT_TOKEN must be changed from the example value");
  }
  if (isPlaceholder(environment.SEAOIL_SNMP_COMMUNITY)) {
    errors.push("SEAOIL_SNMP_COMMUNITY must be changed from the example value");
  }

  const usersFile = resolveRuntimePath(environment.USERS_FILE || "./users.json");
  if (!usersFile || !fileExists(usersFile)) {
    if ((environment.PRINTDASH_ADMIN_PASSWORD || "").length < 12 || isPlaceholder(environment.PRINTDASH_ADMIN_PASSWORD)) {
      errors.push("PRINTDASH_ADMIN_PASSWORD must be a non-placeholder value of at least 12 characters when USERS_FILE does not exist");
    }
    if ((environment.PRINTDASH_USER_PASSWORD || "").length < 12 || isPlaceholder(environment.PRINTDASH_USER_PASSWORD)) {
      errors.push("PRINTDASH_USER_PASSWORD must be a non-placeholder value of at least 12 characters when USERS_FILE does not exist");
    }
  }

  const majorVersion = Number(String(nodeVersion).split(".")[0]);
  if (majorVersion !== 24) {
    warnings.push(`Node.js 24 LTS is recommended for production; detected ${nodeVersion}`);
  }

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    warnings,
  };
}

function secretValues(environment = process.env) {
  return SECRET_ENVIRONMENT_NAMES
    .map(name => environment[name])
    .filter(value => typeof value === "string" && value.length >= 4);
}

function redactLogValue(value, environment = process.env) {
  let safe = String(value ?? "");
  for (const secret of secretValues(environment)) {
    safe = safe.split(secret).join("[REDACTED]");
  }
  return safe
    .replace(/(Bearer\s+)[^\s,;]+/gi, "$1[REDACTED]")
    .replace(/((?:authorization|password|token|community)\s*[:=]\s*)[^\s,;]+/gi, "$1[REDACTED]");
}

function formatListenError(error, port) {
  if (error?.code === "EADDRINUSE") {
    return `SEAOIL Agent cannot start because port ${port} is already in use. Another SEAOIL Agent instance may already be running.`;
  }
  if (error?.code === "EACCES") {
    return `SEAOIL Agent cannot bind to port ${port}. The service account does not have permission to use this address.`;
  }
  return `SEAOIL Agent HTTP server failed: ${redactLogValue(error?.message || error || "unknown error")}`;
}

function createHealthPayload({
  state = "ok",
  startedAt = Date.now(),
  now = Date.now(),
  version = AGENT_VERSION,
} = {}) {
  return {
    status: state,
    version,
    uptimeSeconds: Math.max(0, Math.floor((now - startedAt) / 1000)),
  };
}

function createShutdownCoordinator({ logger = console, steps = [], setExitCode = code => { process.exitCode = code; } } = {}) {
  let shutdownPromise = null;
  return {
    isShuttingDown() {
      return shutdownPromise !== null;
    },
    shutdown(reason, exitCode = 0) {
      if (shutdownPromise) return shutdownPromise;
      shutdownPromise = (async () => {
        logger.log(`[SEAOIL Agent] Graceful shutdown started (${reason}).`);
        for (const step of steps) {
          try {
            await step();
          } catch (error) {
            logger.error(`[SEAOIL Agent] Shutdown cleanup warning: ${redactLogValue(error?.message || error)}`);
          }
        }
        setExitCode(exitCode);
        logger.log(`[SEAOIL Agent] Graceful shutdown complete (${reason}).`);
      })();
      return shutdownPromise;
    },
  };
}

module.exports = {
  DEFAULT_PORT,
  SERVICE_MODE,
  createHealthPayload,
  createShutdownCoordinator,
  formatListenError,
  getRuntimeSettings,
  isPlaceholder,
  parsePort,
  redactLogValue,
  resolveRuntimePath,
  validateServiceStartup,
};
