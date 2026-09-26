import "server-only";

import { copyFile, mkdir, readFile, rename, stat, unlink } from "fs/promises";
import path from "path";

export type UploadKind = "contracts" | "repair-resolutions";

const PRIVATE_PREFIX = "private:";
const PUBLIC_PREFIX = "/uploads/";
const SAFE_FILENAME = /^[a-f\d-]{36}\.[a-z\d]{1,8}$/i;

export function privateUploadRoot() {
  return process.env.PRIVATE_UPLOAD_DIR?.trim()
    || path.join(process.cwd(), "storage", "uploads");
}

export function storedUploadUrl(kind: UploadKind, filename: string) {
  return `${PRIVATE_PREFIX}${kind}/${filename}`;
}

export function uploadFilename(kind: UploadKind, storedUrl: string | null) {
  if (!storedUrl) return null;
  const privatePath = `${PRIVATE_PREFIX}${kind}/`;
  const legacyPath = `${PUBLIC_PREFIX}${kind}/`;
  const filename = storedUrl.startsWith(privatePath)
    ? storedUrl.slice(privatePath.length)
    : storedUrl.startsWith(legacyPath)
      ? storedUrl.slice(legacyPath.length)
      : null;
  return filename && SAFE_FILENAME.test(filename) ? filename : null;
}

export function privateUploadPath(kind: UploadKind, filename: string) {
  if (!SAFE_FILENAME.test(filename)) throw new Error("Invalid upload filename");
  return path.join(privateUploadRoot(), kind, filename);
}

export async function readStoredUpload(kind: UploadKind, storedUrl: string | null) {
  const filename = uploadFilename(kind, storedUrl);
  if (!filename) return null;
  try {
    return await readFile(privateUploadPath(kind, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // Existing records can be read while the private-storage migration is pending.
  if (!storedUrl?.startsWith(`${PUBLIC_PREFIX}${kind}/`)) return null;
  try {
    return await readFile(path.join(process.cwd(), "public", "uploads", kind, filename));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function archiveStoredUpload(kind: UploadKind, storedUrl: string | null) {
  const filename = uploadFilename(kind, storedUrl);
  if (!filename) return;
  const destinationDir = path.join(privateUploadRoot(), "removed", kind);
  await mkdir(destinationDir, { recursive: true, mode: 0o700 });
  const candidates = [
    privateUploadPath(kind, filename),
    path.join(process.cwd(), "public", "uploads", kind, filename),
  ];
  for (const [index, candidate] of candidates.entries()) {
    try {
      await stat(candidate);
      const destination = path.join(destinationDir, `${Date.now()}-${index}-${filename}`);
      try {
        await rename(candidate, destination);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
        await copyFile(candidate, destination);
        await unlink(candidate);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}
