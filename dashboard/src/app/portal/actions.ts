"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie } from "@/lib/auth";

export async function portalLogoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
