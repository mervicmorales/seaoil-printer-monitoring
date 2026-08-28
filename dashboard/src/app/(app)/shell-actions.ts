"use server";

import {
  clearSessionCookie,
  hashPassword,
  isValidPassword,
  PASSWORD_RULE_TEXT,
  verifyPassword,
} from "@/lib/auth";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/server-utils";

export type ChangePasswordResult = {
  success?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string>>;
};

export async function changePasswordAction(
  formData: FormData,
): Promise<ChangePasswordResult> {
  const session = await requireSession();
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");
  const fieldErrors: ChangePasswordResult["fieldErrors"] = {};

  if (!currentPassword) fieldErrors.currentPassword = "Enter your current password.";
  if (!newPassword) fieldErrors.newPassword = "Enter a new password.";
  else if (!isValidPassword(newPassword)) fieldErrors.newPassword = PASSWORD_RULE_TEXT;
  if (!confirmPassword) fieldErrors.confirmPassword = "Re-type your new password.";
  else if (newPassword !== confirmPassword) {
    fieldErrors.confirmPassword = "The new passwords do not match.";
  }
  if (Object.keys(fieldErrors).length > 0) return { fieldErrors };

  const [account] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!account) return { error: "Your account could not be found." };

  const currentPasswordMatches = await verifyPassword(
    currentPassword,
    account.passwordHash,
  );
  if (!currentPasswordMatches) {
    return { fieldErrors: { currentPassword: "The current password is incorrect." } };
  }
  if (await verifyPassword(newPassword, account.passwordHash)) {
    return { fieldErrors: { newPassword: "Choose a password different from your current password." } };
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(users.id, session.id));

  return { success: true };
}

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
