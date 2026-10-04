import assert from "node:assert/strict";
import test from "node:test";
import { canSetTemporaryPassword, type UserRole } from "./roles";

const roles: UserRole[] = ["super_admin", "admin", "support", "employee"];

test("temporary passwords follow the downward role hierarchy", () => {
  const allowed: Record<UserRole, UserRole[]> = {
    super_admin: ["admin", "support", "employee"],
    admin: ["support", "employee"],
    support: ["employee"],
    employee: [],
  };

  for (const actor of roles) {
    for (const target of roles) {
      assert.equal(
        canSetTemporaryPassword(actor, target),
        allowed[actor].includes(target),
        `${actor} -> ${target}`,
      );
    }
  }
});
