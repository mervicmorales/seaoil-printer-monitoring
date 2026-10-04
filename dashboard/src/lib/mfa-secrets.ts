import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "crypto";
import { normalizeRecoveryCode } from "@/lib/totp";

const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function rawEncryptionSecret() {
  const value = process.env.MFA_ENCRYPTION_KEY?.trim();
  if (!value || value.length < 32 || /^(change_me|replace-with-)/i.test(value)) {
    throw new Error("MFA_ENCRYPTION_KEY must be a unique secret of at least 32 characters");
  }
  return value;
}

function encryptionKey() {
  return createHash("sha256").update(rawEncryptionSecret(), "utf8").digest();
}

export function assertMfaConfiguration() {
  rawEncryptionSecret();
}

export function encryptMfaSecret(plainText: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptMfaSecret(value: string) {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1" || !iv || !tag || !ciphertext) throw new Error("Invalid encrypted MFA secret");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(16);
    const raw = Array.from(bytes, (byte) => RECOVERY_ALPHABET[byte & 31]).join("");
    return raw.match(/.{1,4}/g)?.join("-") ?? raw;
  });
}

export function hashRecoveryCode(value: string) {
  return createHmac("sha256", encryptionKey())
    .update(`recovery:${normalizeRecoveryCode(value)}`)
    .digest("hex");
}
