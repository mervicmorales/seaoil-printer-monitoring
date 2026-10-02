import { Building2, CheckCircle2, MailCheck, ShieldCheck, type IconNode } from "lucide";
import { IconGlyph } from "@/components/ui";
import { SYSTEM_LOGO_URL } from "@/lib/branding";
import { getOrganizationOptions } from "@/lib/organization";
import RegisterForm, { ResendVerificationForm } from "./RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const organizationOptions = await getOrganizationOptions();
  const logoUrl = SYSTEM_LOGO_URL;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f7fa] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div aria-hidden="true" className="absolute -right-28 -top-32 size-96 rounded-full bg-[#7DA8D0]/15 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-36 -left-28 size-96 rounded-full bg-[#FEF200]/15 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-6 flex items-center gap-3 sm:mb-8">
          <div className={`flex size-11 items-center justify-center overflow-hidden rounded-xl text-lg font-black ${logoUrl ? "bg-transparent" : "bg-[#014171] text-[#FEF200]"}`}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="SEAOIL logo" className="size-full object-contain" />
            ) : (
              "S"
            )}
          </div>
          <div>
            <p className="font-bold leading-tight text-[#014171]">SEAOIL PrintOps</p>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Employee access</p>
          </div>
        </div>

        <div className="grid overflow-hidden rounded-3xl border border-[#dfe6ee] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.10)] lg:grid-cols-[minmax(17rem,0.72fr)_minmax(0,1.28fr)]">
          <aside className="relative overflow-hidden bg-[#012f53] px-6 py-8 text-white sm:px-8 sm:py-10 lg:px-10 lg:py-12">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-cover bg-[position:18%_center] bg-no-repeat"
              style={{ backgroundImage: "url('/branding/login-print-scan-anywhere.webp')" }}
            />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-[#012b4d]/80 via-[#013d69]/70 to-[#01263f]/92" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-r from-[#012f53]/50 via-[#012f53]/20 to-[#012f53]/35" />
            <div aria-hidden="true" className="absolute -right-20 -top-20 size-56 rounded-full border border-white/10 bg-[#7DA8D0]/10" />
            <div aria-hidden="true" className="absolute -bottom-24 -left-16 size-60 rounded-full bg-[#FEF200]/10 blur-2xl" />

            <div className="relative">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold text-[#e4eef8]">
                <IconGlyph icon={ShieldCheck} size={14} />
                Secured
              </span>
              <h1 className="mt-6 text-3xl font-bold leading-tight tracking-[-0.025em] sm:text-4xl lg:text-[2.6rem]">
                Request access to printer anywhere.
              </h1>
              <p className="mt-4 max-w-md text-sm leading-6 text-[#cfe0f2]">
                Create your employee profile, verify your SEAOIL email, and submit your account for administrator review.
              </p>

              <div className="mt-9 space-y-5 border-t border-white/15 pt-7">
                <RegistrationStep icon={Building2} number="01" title="Employee details" description="Provide your company identity and assignment." />
                <RegistrationStep icon={MailCheck} number="02" title="Email verification" description="Confirm the verification link sent to your inbox." />
                <RegistrationStep icon={CheckCircle2} number="03" title="Administrator review" description="Your request is reviewed before access is activated." />
              </div>
            </div>
          </aside>

          <section className="min-w-0 px-5 py-7 sm:px-8 sm:py-9 lg:px-10 lg:py-12">
            <div className="mx-auto max-w-2xl">
              <div className="mb-7 border-b border-slate-200 pb-6">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#507aa2]">New account request</p>
                <h2 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[#014171] sm:text-3xl">Employee Registration</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Use your official employee information. All fields are required.
                </p>
              </div>

              <RegisterForm organizationOptions={organizationOptions} />
              <ResendVerificationForm />
            </div>
          </section>
        </div>

        <p className="mt-5 text-center text-xs text-slate-400">
          For internal use by SEAOIL Philippines Inc. only.
        </p>
      </div>
    </main>
  );
}

function RegistrationStep({
  icon,
  number,
  title,
  description,
}: {
  icon: IconNode;
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-[#FEF200]">
        <IconGlyph icon={icon} size={18} />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#7DA8D0]">Step {number}</p>
        <p className="mt-0.5 text-sm font-semibold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-[#b9d0e5]">{description}</p>
      </div>
    </div>
  );
}
