import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { normalizePrinterFloor, PRINTER_FLOORS } from "./printer-floor.ts";

test("accepts only supported optional printer floor locations", () => {
  assert.equal(normalizePrinterFloor(" 7th Floor "), "7th Floor");
  assert.equal(normalizePrinterFloor(""), null);
  assert.equal(normalizePrinterFloor("3rd Floor"), null);
  assert.deepEqual(PRINTER_FLOORS, [
    "1st Floor",
    "2nd Floor",
    "7th Floor",
    "10th Floor",
    "19th Floor",
    "22nd Floor",
  ]);
});
