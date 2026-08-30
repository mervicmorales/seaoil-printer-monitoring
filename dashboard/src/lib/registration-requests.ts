import "server-only";

import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db";
import { userRegistrationRequests } from "@/db/schema";

export async function expireRegistrationRequests(now = new Date()) {
  return db.update(userRegistrationRequests).set({ status: "expired" }).where(and(
    eq(userRegistrationRequests.status, "pending_email"),
    lt(userRegistrationRequests.expiresAt, now),
  )).returning({ id: userRegistrationRequests.id });
}
