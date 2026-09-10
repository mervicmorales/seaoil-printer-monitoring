import { and, eq, isNotNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { printOpsCommands } from "@/db/schema";

export const SCAN_RETENTION_HOURS = 72;
export const SCAN_RETENTION_MS = SCAN_RETENTION_HOURS * 60 * 60 * 1_000;

const CLEANUP_INTERVAL_MS = 15 * 60 * 1_000;
let lastCleanupAt = 0;
let activeCleanup: Promise<void> | null = null;

export function scanExpiresAt(completedAt: Date) {
  return new Date(completedAt.getTime() + SCAN_RETENTION_MS);
}

export async function purgeExpiredScanFiles() {
  const now = Date.now();
  if (activeCleanup) return activeCleanup;
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return;

  lastCleanupAt = now;
  activeCleanup = db
    .update(printOpsCommands)
    .set({ outputFileData: null })
    .where(and(
      eq(printOpsCommands.type, "scan"),
      isNotNull(printOpsCommands.outputFileData),
      isNotNull(printOpsCommands.completedAt),
      lt(printOpsCommands.completedAt, new Date(now - SCAN_RETENTION_MS)),
    ))
    .then(() => undefined)
    .catch((error) => {
      lastCleanupAt = 0;
      throw error;
    })
    .finally(() => {
      activeCleanup = null;
    });
  return activeCleanup;
}
