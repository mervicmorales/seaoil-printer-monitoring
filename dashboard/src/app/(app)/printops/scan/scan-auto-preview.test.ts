import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { shouldAutoPreviewScan } from "./scan-auto-preview.ts";

test("auto-previews a completed scan that has not been shown in this browser tab", () => {
  assert.equal(shouldAutoPreviewScan(42, null), true);
  assert.equal(shouldAutoPreviewScan(42, "41"), true);
});

test("does not auto-preview the same completed scan after refresh or navigation", () => {
  assert.equal(shouldAutoPreviewScan(42, "42"), false);
});
