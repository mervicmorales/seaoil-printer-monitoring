import QRCode from "qrcode";
import Link from "next/link";
import { and, count, eq, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide";
import { db } from "@/db";
import { userMfaRecoveryCodes, users } from "@/db/schema";
import { IconGlyph } from "@/components/ui";
import { getSession } from "@/lib/auth";
import { AUTH_LOGO_URL } from "@/lib/branding";
import { decryptMfaSecret } from "@/lib/mfa-secrets";
import { buildTotpUri } from "@/lib/totp";
import SecurityPanel from "./SecurityPanel";

export const dynamic = "force-dynamic";

export default async function AccountSecurityPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/account/security");
  const [account] = await db.select({
    email: users.email,
    role: users.role,
    totpSecretEncrypted: users.totpSecretEncrypted,
    totpPendingSecretEncrypted: users.totpPendingSecretEncrypted,
    totpEnabledAt: users.totpEnabledAt,
  }).from(users).where(eq(users.id, session.id)).limit(1);
  if (!account) redirect("/login");

  const enabled = Boolean(account.totpEnabledAt && account.totpSecretEncrypted);
  const required = account.role === "admin" || account.role === "super_admin";
  const [recoveryCount] = enabled
    ? await db.select({ value: count() }).from(userMfaRecoveryCodes).where(and(
        eq(userMfaRecoveryCodes.userId, session.id),
        isNull(userMfaRecoveryCodes.usedAt),
      ))
    : [{ value: 0 }];
  let qrDataUrl: string | null = null;
  let manualSecret: string | null = null;
  if (!enabled && account.totpPendingSecretEncrypted) {
    try {
      manualSecret = decryptMfaSecret(account.totpPendingSecretEncrypted);
      qrDataUrl = await QRCode.toDataURL(buildTotpUri(manualSecret, account.email), {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 320,
        color: { dark: "#014171", light: "#ffffff" },
      });
    } catch {
      manualSecret = null;
      qrDataUrl = null;
    }
  }
  const returnHref = session.role === "employee" ? "/portal" : session.role === "support" ? "/" : "/overview";

  return (
    <main className="min-h-screen bg-[#f4f7fa] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center overflow-hidden rounded-xl">
              {AUTH_LOGO_URL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={AUTH_LOGO_URL} alt="SEA Print" className="h-full w-full object-contain" />
              ) : <IconGlyph icon={ShieldCheck} size={22} />}
            </div>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#507aa2]">Account</p><h1 className="text-2xl font-bold text-[#014171]">Security settings</h1></div>
          </div>
          <Link href={returnHref} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"><IconGlyph icon={ArrowLeft} size={16} /> Back</Link>
        </header>
        <SecurityPanel
          enabled={enabled}
          required={required}
          enabledAt={account.totpEnabledAt?.toISOString() ?? null}
          recoveryCodesRemaining={Number(recoveryCount?.value ?? 0)}
          qrDataUrl={qrDataUrl}
          manualSecret={manualSecret}
        />
      </div>
    </main>
  );
}
