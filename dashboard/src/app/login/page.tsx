import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import { AlertCircle, BarChart3, CheckCircle2, LockKeyhole, Printer, ShieldCheck, type IconNode } from "lucide";
import { IconGlyph } from "@/components/ui";
import LoginForm from "./LoginForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string; reset?: string }>;
}) {
  const params = await searchParams;
  const [settings] = await db
    .select({ logoUrl: systemSettings.logoUrl })
    .from(systemSettings)
    .limit(1);
  const logoUrl = settings?.logoUrl ?? null;

  return (
    <main className="relative grid min-h-screen grid-cols-1 overflow-hidden bg-[#f4f7fa] lg:grid-cols-[minmax(0,1.05fr)_minmax(28rem,0.95fr)]">
      <section className="relative hidden min-h-screen flex-col justify-between overflow-hidden bg-gradient-to-br from-[#075184] via-[#014171] to-[#012f53] px-12 py-10 text-white lg:flex xl:px-16 xl:py-12">
        <div aria-hidden="true" className="absolute -right-28 -top-32 size-[28rem] rounded-full border border-white/10 bg-[#7DA8D0]/15" />
        <div aria-hidden="true" className="absolute -bottom-40 -left-28 size-[30rem] rounded-full bg-[#FEF200]/10 blur-3xl" />
        <div aria-hidden="true" className="absolute bottom-[18%] right-[8%] size-32 rounded-full border border-white/[0.06]" />

        <div className="relative z-10 flex items-center gap-3.5">
          <div
            className={`flex size-12 items-center justify-center overflow-hidden rounded-xl text-xl font-black text-[#014171] ${
              logoUrl ? "bg-transparent" : "bg-[#FEF200]"
            }`}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="SEAOIL logo" className="h-full w-full object-contain" />
            ) : (
              "S"
            )}
          </div>
          <div>
            <p className="text-lg font-bold leading-tight tracking-[-0.01em]">SEAOIL · PrintOps</p>
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#9fbdda]">
              Philippines Inc.
            </p>
          </div>
        </div>

        <div className="relative z-10 my-12 max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#e5eff8]">
            <IconGlyph icon={ShieldCheck} size={14} />
            Secured
          </span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.12] tracking-[-0.035em] xl:text-5xl">
            Print &amp; Scan Anywhere.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-[#cfe0f2] xl:text-[15px]">
            Use one secure workspace to print, scan, and access available devices across SEAOIL locations.
          </p>

          <div className="mt-9 grid max-w-lg gap-3 sm:grid-cols-3">
            <FeatureItem icon={Printer} label="Print & scan anywhere" />
            <FeatureItem icon={BarChart3} label="Track print jobs" />
            <FeatureItem icon={LockKeyhole} label="Secure access" />
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between gap-5 border-t border-white/15 pt-5 text-[11px] text-[#aac5dd]">
          <p>For internal use by SEAOIL Philippines Inc. only.</p>
          <p className="font-semibold uppercase tracking-[0.12em]">Printer Management System</p>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 sm:py-12 lg:px-10 xl:px-16">
        <div aria-hidden="true" className="absolute -right-28 -top-28 size-80 rounded-full bg-[#7DA8D0]/15 blur-3xl lg:hidden" />
        <div className="relative w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div
              className={`flex size-11 items-center justify-center overflow-hidden rounded-xl text-lg font-black text-[#FEF200] ${
                logoUrl ? "bg-transparent" : "bg-[#014171]"
              }`}
            >
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="SEAOIL logo" className="h-full w-full object-contain" />
              ) : (
                "S"
              )}
            </div>
            <div>
              <p className="font-bold leading-tight text-[#014171]">SEAOIL PrintOps</p>
              <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">Secured</p>
            </div>
          </div>

          <div className="rounded-3xl border border-[#dfe6ee] bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-8">
            <div className="border-b border-slate-200 pb-6">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#507aa2]">Account sign in</p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-[#014171] sm:text-3xl">Welcome back</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Sign in with your SEAOIL employee account to print and scan from available devices wherever you work.
              </p>
            </div>

            {params.verified === "account-activated" && (
              <StatusNotice tone="success" icon={CheckCircle2}>
                Your email has been verified and your account is now active. You can sign in.
              </StatusNotice>
            )}
            {params.reset === "success" && (
              <StatusNotice tone="success" icon={CheckCircle2}>
                Your password has been updated. Sign in with your new password.
              </StatusNotice>
            )}
            {params.verified === "1" && (
              <StatusNotice tone="info" icon={CheckCircle2}>
                Your email has been verified. Your registration is now awaiting administrator approval.
              </StatusNotice>
            )}
            {(params.verified === "0" || params.verified === "invalid") && (
              <StatusNotice tone="error" icon={AlertCircle} alert>
                This verification link is invalid, expired, or has already been used.
              </StatusNotice>
            )}

            <LoginForm nextPath={params.next ?? "/dashboard"} />

            <div className="mt-6 border-t border-slate-200 pt-5 text-center">
              <p className="text-sm text-slate-500">
                SEAOIL employee?{" "}
                <Link href="/register" className="rounded-sm font-semibold text-[#014171] hover:underline focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]">
                  Request access
                </Link>
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-400 lg:justify-start">
            <IconGlyph icon={LockKeyhole} size={13} />
            <span>Your session is protected by secure authentication.</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureItem({ icon, label }: { icon: IconNode; label: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-3">
      <span className="text-[#FEF200]"><IconGlyph icon={icon} size={17} /></span>
      <p className="mt-2 text-xs font-semibold leading-5 text-[#e6f0f8]">{label}</p>
    </div>
  );
}

function StatusNotice({
  tone,
  icon,
  alert = false,
  children,
}: {
  tone: "success" | "info" | "error";
  icon: IconNode;
  alert?: boolean;
  children: React.ReactNode;
}) {
  const styles = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-sky-200 bg-sky-50 text-sky-700",
    error: "border-red-200 bg-red-50 text-red-700",
  }[tone];

  return (
    <div role={alert ? "alert" : "status"} className={`mt-5 flex items-start gap-3 rounded-xl border px-4 py-3 text-sm leading-5 ${styles}`}>
      <span className="mt-0.5 shrink-0"><IconGlyph icon={icon} size={17} /></span>
      <span>{children}</span>
    </div>
  );
}
