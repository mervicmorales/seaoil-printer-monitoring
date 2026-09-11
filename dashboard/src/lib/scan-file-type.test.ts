import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { detectScanFileType, replaceScanFileExtension } from "./scan-file-type.ts";

test("detects supported scan files by signature instead of reported printer metadata", () => {
  assert.deepEqual(detectScanFileType(Buffer.from("%PDF-test")), {
    mimeType: "application/pdf",
    extension: "pdf",
  });
  assert.deepEqual(detectScanFileType(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), {
    mimeType: "image/jpeg",
    extension: "jpg",
  });
  assert.deepEqual(detectScanFileType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), {
    mimeType: "image/png",
    extension: "png",
  });
  assert.equal(detectScanFileType(Buffer.from("unknown")), null);
});

test("replaces a scanner-reported file extension", () => {
  assert.equal(replaceScanFileExtension("scan-123.pdf", "jpg"), "scan-123.jpg");
  assert.equal(replaceScanFileExtension("scan-123", "png"), "scan-123.png");
});
