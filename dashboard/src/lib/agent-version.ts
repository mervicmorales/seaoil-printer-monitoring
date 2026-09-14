export type AgentUpdateStatus =
  | "up-to-date"
  | "update-available"
  | "unknown-version";

type ParsedSemver = {
  core: [string, string, string];
  prerelease: string[];
};

const SEMVER_PATTERN =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export function parseSemver(value: string | null | undefined): ParsedSemver | null {
  const match = value?.trim().match(SEMVER_PATTERN);
  if (!match) return null;
  const prerelease = match[4]?.split(".") ?? [];
  if (prerelease.some((part) => /^\d+$/.test(part) && part.length > 1 && part.startsWith("0"))) {
    return null;
  }
  return {
    core: [match[1], match[2], match[3]],
    prerelease,
  };
}

function compareNumericStrings(left: string, right: string) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

export function compareSemver(
  left: string | null | undefined,
  right: string | null | undefined,
): -1 | 0 | 1 | null {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return null;

  for (let index = 0; index < 3; index += 1) {
    const comparison = compareNumericStrings(a.core[index], b.core[index]);
    if (comparison !== 0) return comparison;
  }

  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;

  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftPart = a.prerelease[index];
    const rightPart = b.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumeric = /^\d+$/.test(leftPart);
    const rightNumeric = /^\d+$/.test(rightPart);
    if (leftNumeric && rightNumeric) return compareNumericStrings(leftPart, rightPart);
    if (leftNumeric) return -1;
    if (rightNumeric) return 1;
    return leftPart < rightPart ? -1 : 1;
  }
  return 0;
}

export function getAgentUpdateStatus(
  installedVersion: string | null | undefined,
  latestVersion: string | null | undefined,
): AgentUpdateStatus {
  const comparison = compareSemver(installedVersion, latestVersion);
  if (comparison === null) return "unknown-version";
  return comparison < 0 ? "update-available" : "up-to-date";
}

export function isAgentOnline({
  storedStatus,
  lastSeen,
  tokenRevokedAt,
  staleSeconds,
  now = new Date(),
}: {
  storedStatus: string;
  lastSeen: Date | null;
  tokenRevokedAt: Date | null;
  staleSeconds: number;
  now?: Date;
}) {
  return (
    storedStatus === "online" &&
    tokenRevokedAt === null &&
    lastSeen !== null &&
    lastSeen.getTime() >= now.getTime() - staleSeconds * 1_000
  );
}

export function platformLabel(platform: string | null) {
  if (platform === "win32") return "Windows";
  if (platform === "darwin") return "macOS";
  if (platform === "linux") return "Linux";
  return platform || "Unknown";
}
