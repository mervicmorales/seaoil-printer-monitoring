import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's type-stripping test runner requires the explicit TypeScript extension.
import { EMPLOYEE_ID_PREFIXES, isValidEmployeeId } from "./validation.ts";

test("accepts every approved employee ID prefix followed by five digits", () => {
  for (const prefix of EMPLOYEE_ID_PREFIXES) {
    assert.equal(isValidEmployeeId(`${prefix}12345`), true, prefix);
    assert.equal(isValidEmployeeId(`${prefix.toLowerCase()}12345`), true, `${prefix} lowercase`);
  }
});

test("rejects unsupported prefixes and invalid digit counts", () => {
  for (const employeeId of [
    "ABC12345",
    "SPI1234",
    "SPI123456",
    "SPI12A45",
    "12345",
    "",
  ]) {
    assert.equal(isValidEmployeeId(employeeId), false, employeeId || "empty value");
  }
});
