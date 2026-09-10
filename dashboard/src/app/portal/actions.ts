"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import {
  auditLogs,
  notifications,
  printerAccessRequests,
} from "@/db/schema";
import { getEmployeePrinterRequestScope } from "@/lib/employee-printer-requests";
import { requireSession } from "@/lib/server-utils";

export type PrinterAccessRequestResult = {
  success?: string;
  error?: string;
  printerId?: number;
};

export async function requestPrinterAccessAction(
  printerId: number,
): Promise<PrinterAccessRequestResult> {
  const session = await requireSession();
  if (session.role !== "employee") {
    return { error: "Only Employee accounts can request printer access." };
  }
  if (!Number.isSafeInteger(printerId) || printerId < 1) {
    return { error: "Select a valid printer." };
  }

  const requestHeaders = await headers();
  const scope = await getEmployeePrinterRequestScope(session.id, requestHeaders);
  const printer = scope.printers.find((candidate) => candidate.id === printerId);
  if (!printer) {
    return { error: "This printer is not available through your current office agent." };
  }
  if (printer.alreadyAccessible) {
    return { error: "This printer is already available to your account." };
  }

  const [existing] = await db
    .select({ status: printerAccessRequests.status })
    .from(printerAccessRequests)
    .where(and(
      eq(printerAccessRequests.userId, session.id),
      eq(printerAccessRequests.printerId, printerId),
    ))
    .limit(1);
  if (existing?.status === "pending") {
    return {
      success: "Your request for this printer is already pending.",
      printerId,
    };
  }

  const requestedAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .insert(printerAccessRequests)
      .values({
        userId: session.id,
        agentId: printer.agentId,
        printerId,
        status: "pending",
        requestedAt,
        updatedAt: requestedAt,
      })
      .onConflictDoUpdate({
        target: [printerAccessRequests.userId, printerAccessRequests.printerId],
        set: {
          agentId: printer.agentId,
          status: "pending",
          requestedAt,
          reviewedBy: null,
          reviewedAt: null,
          updatedAt: requestedAt,
        },
      });
    await tx.insert(notifications).values({
      type: "printer-access-request",
      message: `${session.fullName} requested access to printer ${printer.serialNumber} at ${printer.locationName || "an assigned office"}.`,
    });
    await tx.insert(auditLogs).values({
      actorUserId: session.id,
      action: "printer_access.requested",
      targetType: "printer",
      targetId: String(printerId),
      metadata: {
        agentId: printer.agentId,
        networkScope: scope.mode,
        location: printer.locationName,
      },
    });
  });

  revalidatePath("/portal");
  revalidatePath(`/manage/${session.id}`);
  revalidatePath(`/manage/users/${session.id}`);
  return {
    success: "Request saved. Review the prepared email in Gmail and click Send.",
    printerId,
  };
}
