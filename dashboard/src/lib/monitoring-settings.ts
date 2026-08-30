import "server-only";
import { db } from "@/db";
import { systemSettings } from "@/db/schema";

const DEFAULT_STALE_SECONDS = 180;
const MIN_STALE_SECONDS = 60;
const MAX_STALE_SECONDS = 86_400;

export async function getMonitoringStaleSeconds() {
  const [settings] = await db.select({ minutes: systemSettings.agentOfflineThresholdMinutes }).from(systemSettings).limit(1);
  if (settings && Number.isInteger(settings.minutes) && settings.minutes >= 1 && settings.minutes <= 1_440) {
    return settings.minutes * 60;
  }
  const parsed = Number(process.env.MONITORING_STALE_SECONDS);
  return Number.isInteger(parsed) && parsed >= MIN_STALE_SECONDS && parsed <= MAX_STALE_SECONDS
    ? parsed
    : DEFAULT_STALE_SECONDS;
}
