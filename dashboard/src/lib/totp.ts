import { createHmac, randomBytes, timingSafeEqual } from "crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;

export function encodeBase32(value: Buffer) {
  let bits = 0;
  let accumulator = 0;
  let output = "";

  for (const byte of value) {
    accumulator = (accumulator << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(accumulator >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(accumulator << (5 - bits)) & 31];
  return output;
}

export function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let accumulator = 0;
  const bytes: number[] = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error("Invalid base32 secret");
    accumulator = (accumulator << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((accumulator >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function totpStep(at = Date.now()) {
  return Math.floor(at / 1000 / TOTP_PERIOD_SECONDS);
}

export function generateTotpCode(secret: string, step: number) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = createHmac("sha1", decodeBase32(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  ) >>> 0;
  return String(binary % (10 ** TOTP_DIGITS)).padStart(TOTP_DIGITS, "0");
}

export function verifyTotpCode(
  rawCode: string,
  secret: string,
  options: { at?: number; window?: number; afterStep?: number | null } = {},
) {
  const code = rawCode.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const candidate = Buffer.from(code);
  const currentStep = totpStep(options.at);
  const window = Math.max(0, Math.min(options.window ?? 1, 2));
  const offsets = [0, ...Array.from({ length: window }, (_, index) => -(index + 1)), ...Array.from({ length: window }, (_, index) => index + 1)];

  for (const offset of offsets) {
    const step = currentStep + offset;
    if (options.afterStep != null && step <= options.afterStep) continue;
    const expected = Buffer.from(generateTotpCode(secret, step));
    if (expected.length === candidate.length && timingSafeEqual(expected, candidate)) return step;
  }
  return null;
}

export function buildTotpUri(secret: string, accountName: string, issuer = "SEA Print") {
  const label = `${issuer}:${accountName}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export function normalizeRecoveryCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z2-9]/g, "");
}
