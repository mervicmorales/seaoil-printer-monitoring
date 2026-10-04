import { createHash } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import Image from "next/image";
import Link from "next/link";
import { db } from "@/db";
import { passwordResetTokens } from "@/db/schema";
import { AUTH_LOGO_URL } from "@/lib/branding";
import ResetPasswordForm from "./ResetPasswordForm";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [validToken] = token
    ? await db
        .select({ id: passwordResetTokens.id })
        .from(passwordResetTokens)
        .where(and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          isNull(passwordResetTokens.consumedAt),
          gt(passwordResetTokens.expiresAt, new Date()),
        ))
        .limit(1)
    : [];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f9] px-6 py-12">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
        <div className="mb-6 size-12 overflow-hidden">
          <Image
            src={AUTH_LOGO_URL}
            alt="SEA Print logo"
            width={512}
            height={512}
            priority
            className="size-full object-contain"
          />
        </div>
        <h1 className="text-2xl font-bold text-[#014171]">Create a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Choose a strong password for your SEA Print account.
        </p>

        {validToken ? (
          <ResetPasswordForm token={token} />
        ) : (
          <div className="mt-6">
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This password reset link is invalid, expired, or has already been used.
            </p>
            <Link
              href="/forgot-password"
              className="mt-5 flex w-full items-center justify-center rounded-lg bg-[#014171] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2"
            >
              Request a new link
            </Link>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-[#014171] hover:underline">
            Back to sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
