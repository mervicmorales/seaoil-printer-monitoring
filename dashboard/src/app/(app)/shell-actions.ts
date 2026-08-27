"use server";

import { clearSessionCookie } from "@/lib/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function logoutAction() {
  await clearSessionCookie();
  return { success: true } as const;
}

export async function markNotificationReadAction(id: number) {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
  revalidatePath("/", "layout");
}

export async function markAllNotificationsReadAction() {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.isRead, false));
  revalidatePath("/", "layout");
}
