import "server-only";

const DEFAULT_STALE_SECONDS = 180;
const MIN_STALE_SECONDS = 60;
const MAX_STALE_SECONDS = 86_400;

export function getMonitoringStaleSeconds() {
  const parsed = Number(process.env.MONITORING_STALE_SECONDS);
  return Number.isInteger(parsed) && parsed >= MIN_STALE_SECONDS && parsed <= MAX_STALE_SECONDS
    ? parsed
    : DEFAULT_STALE_SECONDS;
}
