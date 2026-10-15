import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { canTransitionTonerTransaction, normalizeTonerTransactionStatus, tonerInventoryDelta } from "./toner-transaction-status.ts";

test("normalizes the legacy Delivery status to Delivered", () => {
  assert.equal(normalizeTonerTransactionStatus("Delivery"), "Delivered");
  assert.equal(normalizeTonerTransactionStatus("Delivered"), "Delivered");
});

test("applies stock only for Delivered and Request transactions", () => {
  assert.equal(tonerInventoryDelta("Purchase", 10), 0);
  assert.equal(tonerInventoryDelta("Delivered", 10), 10);
  assert.equal(tonerInventoryDelta("Request", 10), -10);
});

test("allows Delivered only as a transition from Purchase", () => {
  assert.equal(canTransitionTonerTransaction("Purchase", "Delivered"), true);
  assert.equal(canTransitionTonerTransaction("Request", "Delivered"), false);
  assert.equal(canTransitionTonerTransaction("Delivered", "Purchase"), false);
});
