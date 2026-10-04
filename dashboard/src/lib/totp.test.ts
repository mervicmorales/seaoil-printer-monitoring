import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTotpUri,
  decodeBase32,
  encodeBase32,
  generateTotpCode,
  normalizeRecoveryCode,
  verifyTotpCode,
} from "./totp";

test("encodes and decodes base32 secrets", () => {
  const input = Buffer.from("12345678901234567890", "ascii");
  const encoded = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(encodeBase32(input), encoded);
  assert.deepEqual(decodeBase32(encoded), input);
});

test("matches the RFC 6238 SHA-1 vector when reduced to six digits", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(generateTotpCode(secret, 1), "287082");
  assert.equal(verifyTotpCode("287082", secret, { at: 59_000, window: 0 }), 1);
});

test("rejects a previously consumed time step", () => {
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(verifyTotpCode("287082", secret, { at: 59_000, window: 0, afterStep: 1 }), null);
});

test("builds a standards-compatible authenticator URI", () => {
  const uri = buildTotpUri("ABC234", "admin@seaoil.com.ph");
  assert.match(uri, /^otpauth:\/\/totp\/SEA%20Print%3Aadmin%40seaoil\.com\.ph\?/);
  assert.match(uri, /secret=ABC234/);
  assert.match(uri, /issuer=SEA\+Print/);
});

test("normalizes formatted recovery codes", () => {
  assert.equal(normalizeRecoveryCode("abcd-2345 efgh-6789"), "ABCD2345EFGH6789");
});
