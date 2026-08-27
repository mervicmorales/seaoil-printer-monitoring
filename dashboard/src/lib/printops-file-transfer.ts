import "server-only";

const PRINT_FILE_TTL_MS = 10 * 60 * 1_000;
const MAX_PENDING_PRINT_BYTES = 100 * 1024 * 1024;

type PendingPrintFile = {
  data: Buffer;
  timeout: ReturnType<typeof setTimeout>;
};

const globalForPrintOps = globalThis as typeof globalThis & {
  __printOpsPendingFiles?: Map<string, PendingPrintFile>;
};

const pendingFiles =
  globalForPrintOps.__printOpsPendingFiles ?? new Map<string, PendingPrintFile>();

globalForPrintOps.__printOpsPendingFiles = pendingFiles;

export function holdPrintFile(transferKey: string, data: Buffer) {
  const pendingBytes = [...pendingFiles.values()].reduce(
    (total, pending) => total + pending.data.byteLength,
    0,
  );
  if (pendingBytes + data.byteLength > MAX_PENDING_PRINT_BYTES) {
    throw new Error("The temporary print transfer limit has been reached. Try again shortly.");
  }

  discardPrintFile(transferKey);
  const timeout = setTimeout(() => discardPrintFile(transferKey), PRINT_FILE_TTL_MS);
  timeout.unref();
  pendingFiles.set(transferKey, { data, timeout });
}

export function claimPrintFile(transferKey: string) {
  const pending = pendingFiles.get(transferKey);
  if (!pending) return null;
  clearTimeout(pending.timeout);
  pendingFiles.delete(transferKey);
  return pending.data;
}

export function discardPrintFile(transferKey: string) {
  const pending = pendingFiles.get(transferKey);
  if (!pending) return;
  clearTimeout(pending.timeout);
  pendingFiles.delete(transferKey);
}
