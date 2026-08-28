"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { redirect } from "next/navigation";
import { setSessionCookie, verifyPassword } from "@/lib/auth";

export type LoginState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

function safeRedirectPath(value: string) {
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) {
    return "/dashboard";
  }
  return value;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const identifier = String(formData.get("identifier") || "").trim();
  const password = String(formData.get("password") || "");
  const redirectTo = safeRedirectPath(String(formData.get("next") || "/dashboard"));

  const fieldErrors: Record<string, string> = {};
  if (!identifier) fieldErrors.identifier = "Email or username is required.";
  if (!password) fieldErrors.password = "Password is required.";
  if (Object.keys(fieldErrors).length) {
    return { fieldErrors };
  }

  const rows = await db
    .select()
    .from(users)
    .where(or(eq(users.username, identifier), eq(users.email, identifier)))
    .limit(1);

  const user = rows[0];
  if (!user) {
    return { error: "Invalid credentials. Please check your email/username and password." };
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid credentials. Please check your email/username and password." };
  }

  await setSessionCookie({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    role: user.role as "admin" | "user",
  });

  redirect(redirectTo);
}
