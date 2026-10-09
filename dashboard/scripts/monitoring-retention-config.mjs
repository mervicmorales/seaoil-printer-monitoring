const DEFAULTS = Object.freeze({
  rawRetentionDays: 30,
  summaryRetentionDays: 730,
  resolvedAlertRetentionDays: 365,
  deleteBatchSize: 10_000,
  scheduleHour: 2,
  scheduleMinute: 30,
  timezone: "Asia/Manila",
});

function integerFromEnvironment(value, fallback, minimum, maximum) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`Expected an integer from ${minimum} to ${maximum}, received ${value}`);
  }
  return parsed;
}

export function retentionConfig(environment = process.env) {
  const timezone = environment.MONITORING_RETENTION_TIMEZONE?.trim() || DEFAULTS.timezone;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Invalid MONITORING_RETENTION_TIMEZONE: ${timezone}`);
  }

  return {
    rawRetentionDays: integerFromEnvironment(
      environment.MONITORING_RAW_RETENTION_DAYS,
      DEFAULTS.rawRetentionDays,
      1,
      3650,
    ),
    summaryRetentionDays: integerFromEnvironment(
      environment.MONITORING_SUMMARY_RETENTION_DAYS,
      DEFAULTS.summaryRetentionDays,
      30,
      36500,
    ),
    resolvedAlertRetentionDays: integerFromEnvironment(
      environment.RESOLVED_ALERT_RETENTION_DAYS,
      DEFAULTS.resolvedAlertRetentionDays,
      30,
      36500,
    ),
    deleteBatchSize: integerFromEnvironment(
      environment.RETENTION_DELETE_BATCH_SIZE,
      DEFAULTS.deleteBatchSize,
      100,
      100_000,
    ),
    scheduleHour: integerFromEnvironment(
      environment.MONITORING_RETENTION_HOUR,
      DEFAULTS.scheduleHour,
      0,
      23,
    ),
    scheduleMinute: integerFromEnvironment(
      environment.MONITORING_RETENTION_MINUTE,
      DEFAULTS.scheduleMinute,
      0,
      59,
    ),
    timezone,
  };
}

export function retentionEnabled(environment = process.env) {
  const value = environment.MONITORING_RETENTION_ENABLED?.trim().toLowerCase();
  return value === undefined || value === "" || ["1", "true", "yes", "on"].includes(value);
}

function zonedParts(date, timezone) {
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

function timezoneOffsetMilliseconds(date, timezone) {
  const parts = zonedParts(date, timezone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - date.getTime();
}

function zonedDateToUtc(year, month, day, hour, minute, timezone) {
  const guessedUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  let result = guessedUtc - timezoneOffsetMilliseconds(new Date(guessedUtc), timezone);
  result = guessedUtc - timezoneOffsetMilliseconds(new Date(result), timezone);
  return new Date(result);
}

export function nextScheduledRun(now, config) {
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

export { DEFAULTS as monitoringRetentionDefaults };
