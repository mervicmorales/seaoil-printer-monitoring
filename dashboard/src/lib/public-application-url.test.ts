import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { publicApplicationUrl } from "./public-application-url.ts";

test("uses the configured public origin and preserves its port", () => {
  const target = publicApplicationUrl(
    "/login",
    "http://localhost:3000/verify-email?token=secret",
    "http://seaprint.seaoil.com.ph:3000",
  );

  target.searchParams.set("verified", "1");

  assert.equal(target.toString(), "http://seaprint.seaoil.com.ph:3000/login?verified=1");
});

test("falls back to the incoming request origin when no public URL is configured", () => {
  const target = publicApplicationUrl(
    "/login",
    "http://localhost:3000/verify-email?token=secret",
    "",
  );

  assert.equal(target.toString(), "http://localhost:3000/login");
});
