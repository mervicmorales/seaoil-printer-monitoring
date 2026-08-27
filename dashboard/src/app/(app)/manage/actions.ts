"use server";

import { db } from "@/db";
import { users, userModuleAccess } from "@/db/schema";
import { eq, and, ne, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/server-utils";
import { hashPassword, isValidEmail, isValidPassword, PASSWORD_RULE_TEXT } from "@/lib/auth";
import { MODULES, defaultAccessForRole } from "@/lib/permissions";

function str(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  return s.length ? s : null;
}
function num(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

export type UserFormState = { error?: string; fieldErrors?: Record<string, string> };

export async function createUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireAdmin();

  const fullName = str(formData.get("fullName"));
  const email = str(formData.get("email"));
  const username = str(formData.get("username"));
  const password = String(formData.get("password") || "");
  const role = (str(formData.get("role")) || "user") as "admin" | "user";

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Full Name is required.";
  if (!email) fieldErrors.email = "Email Address is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (!username) fieldErrors.username = "Username is required.";
  if (!password) fieldErrors.password = "Password is required.";
  else if (!isValidPassword(password)) fieldErrors.password = PASSWORD_RULE_TEXT;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const passwordHash = await hashPassword(password);
    const inserted = await db
      .insert(users)
      .values({ fullName: fullName!, email: email!, username: username!, passwordHash, role })
      .returning();

    const userId = inserted[0].id;
    const defaults = defaultAccessForRole(role);
    await db.insert(userModuleAccess).values(MODULES.map((m) => ({ userId, module: m, fullAccess: defaults[m] })));
  } catch (err) {
    console.error(err);
    return { error: "Could not create user. Email or username may already be in use." };
  }

  revalidatePath("/manage");
  redirect("/manage?success=User created successfully.");
}

export async function updateUserAction(_prev: UserFormState, formData: FormData): Promise<UserFormState> {
  await requireAdmin();

  const id = num(formData.get("id"));
  if (!id) return { error: "Invalid user." };

  const fullName = str(formData.get("fullName"));
  const email = str(formData.get("email"));
  const username = str(formData.get("username"));
  const password = String(formData.get("password") || "");
  const role = (str(formData.get("role")) || "user") as "admin" | "user";

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = "Full Name is required.";
  if (!email) fieldErrors.email = "Email Address is required.";
  else if (!isValidEmail(email)) fieldErrors.email = "Enter a valid email address.";
  if (!username) fieldErrors.username = "Username is required.";
  if (password && !isValidPassword(password)) fieldErrors.password = PASSWORD_RULE_TEXT;
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  try {
    const updateValues: Record<string, unknown> = { fullName, email, username, role };
    if (password) updateValues.passwordHash = await hashPassword(password);
    await db.update(users).set(updateValues).where(eq(users.id, id));
  } catch (err) {
    console.error(err);
    return { error: "Could not update user. Email or username may already be in use." };
  }

  revalidatePath("/manage");
  redirect("/manage?success=User updated successfully.");
}

export async function deleteUserAction(formData: FormData) {
  const admin = await requireAdmin();
  const id = num(formData.get("id"));
  if (!id || id === admin.id) {
    redirect("/manage?success=Cannot delete this account.");
  }
  await db.delete(users).where(eq(users.id, id!));
  revalidatePath("/manage");
  redirect("/manage?success=User deleted.");
}

export async function updatePermissionsAction(formData: FormData) {
  await requireAdmin();
  const userId = num(formData.get("userId"));
  if (!userId) return;

  for (const mod of MODULES) {
    const fullAccess = formData.get(`module_${mod}`) === "on";
    await db
      .insert(userModuleAccess)
      .values({ userId, module: mod, fullAccess })
      .onConflictDoUpdate({ target: [userModuleAccess.userId, userModuleAccess.module], set: { fullAccess } });
  }

  revalidatePath("/manage");
  redirect("/manage?success=Permissions updated.");
}
