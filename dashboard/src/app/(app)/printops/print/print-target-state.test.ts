import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { getDefaultPrintTarget } from "./print-target-state.ts";

const agents = [
  {
    id: 10,
    printers: [
      { printerId: 101 },
      { printerId: 102 },
    ],
  },
  {
    id: 20,
    printers: [
      { printerId: 201 },
    ],
  },
];

test("selecting an agent defaults the print target to its first printer", () => {
  assert.equal(getDefaultPrintTarget(agents, "20"), "20|201");
});

test("selecting an agent without a printer clears the print target", () => {
  assert.equal(getDefaultPrintTarget([{ id: 30, printers: [] }], "30"), "");
});
