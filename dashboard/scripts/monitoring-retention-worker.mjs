import {
  nextScheduledRun,
  retentionConfig,
  retentionEnabled,
} from "./monitoring-retention-config.mjs";
import { runMonitoringRetention } from "./prune-monitoring-history.mjs";

const RETRY_DELAY_MS = 60 * 60 * 1000;
const MAX_TIMEOUT_MS = 2_147_000_000;
let timer = null;
let stopping = false;

function schedule(delayMilliseconds) {
  if (stopping) return;
  timer = setTimeout(runAndSchedule, Math.min(delayMilliseconds, MAX_TIMEOUT_MS));
}

async function runAndSchedule() {
  if (stopping) return;
  try {
    await runMonitoringRetention();
    const config = retentionConfig();
    const nextRun = nextScheduledRun(new Date(), config);
    console.log(
      `Next monitoring retention cleanup is scheduled for ${nextRun.toISOString()} ` +
        `(${config.scheduleHour.toString().padStart(2, "0")}:` +
        `${config.scheduleMinute.toString().padStart(2, "0")} ${config.timezone}).`,
    );
    schedule(Math.max(1_000, nextRun.getTime() - Date.now()));
  } catch (error) {
    console.error(
      "Monitoring retention worker will retry in one hour:",
      error instanceof Error ? error.message : error,
    );
    schedule(RETRY_DELAY_MS);
  }
}

function stop(signal) {
  stopping = true;
  if (timer) clearTimeout(timer);
  console.log(`Monitoring retention worker stopped after ${signal}.`);
}

process.once("SIGTERM", () => stop("SIGTERM"));
process.once("SIGINT", () => stop("SIGINT"));

if (!retentionEnabled()) {
  console.log("Monitoring retention worker is disabled.");
  timer = setInterval(() => undefined, 24 * 60 * 60 * 1000);
} else {
  const config = retentionConfig();
  console.log(
    `Monitoring retention worker started with ${config.rawRetentionDays} raw days, ` +
      `${config.summaryRetentionDays} summary days, and ` +
      `${config.resolvedAlertRetentionDays} resolved-alert days.`,
  );
  void runAndSchedule();
}
