export type RetentionDisplayConfig = {
  enabled: boolean;
  rawRetentionDays: number;
  summaryRetentionDays: number;
  resolvedAlertRetentionDays: number;
  scheduleHour: number;
  scheduleMinute: number;
  timezone: string;
};

function integerSetting(value: string | undefined, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum ? parsed : fallback;
}

export function retentionDisplayConfig(
  environment: Record<string, string | undefined> = process.env,
): RetentionDisplayConfig {
  const enabledValue = environment.MONITORING_RETENTION_ENABLED?.trim().toLowerCase();
  return {
    enabled:
      enabledValue === undefined ||
      enabledValue === "" ||
      ["1", "true", "yes", "on"].includes(enabledValue),
    rawRetentionDays: integerSetting(environment.MONITORING_RAW_RETENTION_DAYS, 30, 1, 3650),
    summaryRetentionDays: integerSetting(
      environment.MONITORING_SUMMARY_RETENTION_DAYS,
      730,
      30,
      36500,
    ),
    resolvedAlertRetentionDays: integerSetting(
      environment.RESOLVED_ALERT_RETENTION_DAYS,
      365,
      30,
      36500,
    ),
    scheduleHour: integerSetting(environment.MONITORING_RETENTION_HOUR, 2, 0, 23),
    scheduleMinute: integerSetting(environment.MONITORING_RETENTION_MINUTE, 30, 0, 59),
    timezone: environment.MONITORING_RETENTION_TIMEZONE?.trim() || "Asia/Manila",
  };
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

function timezoneOffsetMilliseconds(date: Date, timezone: string) {
  const parts = zonedParts(date, timezone);
  return (
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    ) - date.getTime()
  );
}

function zonedDateToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
) {
  const guessedUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let result = guessedUtc - timezoneOffsetMilliseconds(new Date(guessedUtc), timezone);
  result = guessedUtc - timezoneOffsetMilliseconds(new Date(result), timezone);
  return new Date(result);
}

export function nextRetentionRun(now: Date, config: RetentionDisplayConfig) {
  if (!config.enabled) return null;
  const parts = zonedParts(now, config.timezone);
  let year = Number(parts.year);
  let month = Number(parts.month);
  let day = Number(parts.day);
  let candidate = zonedDateToUtc(
    year,
    month,
    day,
    config.scheduleHour,
    config.scheduleMinute,
    config.timezone,
  );
  if (candidate.getTime() <= now.getTime()) {
    const followingDay = new Date(Date.UTC(year, month - 1, day + 1));
    year = followingDay.getUTCFullYear();
    month = followingDay.getUTCMonth() + 1;
    day = followingDay.getUTCDate();
    candidate = zonedDateToUtc(
      year,
      month,
      day,
      config.scheduleHour,
      config.scheduleMinute,
      config.timezone,
    );
  }
  return candidate;
}

export function databaseSizeLabel(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "Unavailable";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[index]}`;
}

export type RetentionHealth = "healthy" | "running" | "failed" | "waiting" | "disabled";

export function retentionHealth(
  enabled: boolean,
  latestStatus: string | null,
  latestCompletedAt: Date | null,
  now: Date,
): RetentionHealth {
  if (!enabled) return "disabled";
  if (latestStatus === "failed") return "failed";
  if (latestStatus === "running") return "running";
  if (!latestCompletedAt) return "waiting";
  return now.getTime() - latestCompletedAt.getTime() > 36 * 60 * 60 * 1000
    ? "waiting"
    : "healthy";
}
