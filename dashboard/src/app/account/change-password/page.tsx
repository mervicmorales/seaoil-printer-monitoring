import { eq, sql } from "drizzle-orm";
import { KeyRound } from "lucide";
import { redirect } from "next/navigation";
import { IconGlyph } from "@/components/ui";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/auth";
import { AUTH_LOGO_URL } from "@/lib/branding";
import { type UserRole } from "@/lib/roles";
import { skipTemporaryPasswordChangeAction } from "./actions";
import TemporaryPasswordForm from "./TemporaryPasswordForm";

export const dynamic = "force-dynamic";

function defaultDestination(role: UserRole) {
  return role === "employee" ? "/portal" : role === "support" ? "/" : "/overview";
}

function safeDestination(value: string | undefined, role: UserRole) {
  if (
    !value?.startsWith("/")
    || value.startsWith("//")
    || value.startsWith("/login")
    || value.startsWith("/account/change-password")
  ) return defaultDestination(role);
  return value;
}

export default async function TemporaryPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const params = await searchParams;
  const destination = safeDestination(params.next, session.role);
  const [account] = await db
    .select({
      passwordChangeRequired: users.passwordChangeRequired,
      temporaryPasswordExpired: sql<boolean>`${users.temporaryPasswordExpiresAt} is null or ${users.temporaryPasswordExpiresAt} <= now()`,
    })
    .from(users)
    .where(eq(users.id, session.id))
    .limit(1);
  if (!account?.passwordChangeRequired) redirect(destination);

  const expired = account.temporaryPasswordExpired;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fa] px-4 py-8 sm:px-8">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)]">
        <div className="border-b border-slate-200 bg-gradient-to-r from-[#012f53] to-[#075985] px-6 py-5 text-white sm:px-8">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/10">
              {AUTH_LOGO_URL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={AUTH_LOGO_URL} alt="SEA Print" className="h-full w-full object-contain" />
              ) : (
                <IconGlyph icon={KeyRound} size={22} />
              )}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-200">Account security</p>
              <p className="mt-1 text-lg font-bold">SEA Print</p>
            </div>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-[-0.025em] text-[#014171] sm:text-3xl">
            Change your temporary password
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            IT assigned a temporary password to your account. Create a permanent password that only you know.
          </p>

          {expired || params.expired === "1" ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
              Your temporary password has expired. Because this session is already verified, you can still replace it now, but you cannot skip this step.
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-900">
              You may skip this for the current session. You will be asked again the next time you sign in, and the temporary password still expires in 24 hours.
            </div>
          )}

          <TemporaryPasswordForm nextPath={destination} />

          {!expired && params.expired !== "1" ? (
            <form action={skipTemporaryPasswordChangeAction} className="mt-3">
              <input type="hidden" name="next" value={destination} />
              <button type="submit" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                Skip for now
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </main>
  );
}
