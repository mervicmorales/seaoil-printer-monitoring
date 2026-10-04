import type { ReactNode } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide";
import { IconGlyph } from "@/components/ui";
import { AUTH_LOGO_URL } from "@/lib/branding";

export default function AuthenticatorFrame({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f4f7fa] px-4 py-10">
      <div aria-hidden="true" className="absolute -left-32 -top-32 size-96 rounded-full bg-[#7DA8D0]/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 -right-28 size-[30rem] rounded-full bg-[#FEF200]/10 blur-3xl" />
      <div className="relative w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex size-12 items-center justify-center overflow-hidden rounded-xl">
            {AUTH_LOGO_URL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={AUTH_LOGO_URL} alt="SEA Print" className="h-full w-full object-contain" />
            ) : (
              <span className="font-black text-[#014171]">S</span>
            )}
          </div>
          <div>
            <p className="text-lg font-bold leading-none text-[#014171]">SEA <span className="text-amber-600">Print</span></p>
            <p className="mt-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-400">Printer Management System</p>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.10)] sm:p-8">
          <div className="flex items-start gap-4 border-b border-slate-200 pb-5">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
              <IconGlyph icon={ShieldCheck} size={22} />
            </span>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#507aa2]">{eyebrow}</p>
              <h1 className="mt-1 text-2xl font-bold tracking-[-0.025em] text-[#014171]">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </div>
          </div>
          {children}
        </section>

        <p className="mt-5 text-center text-xs text-slate-500">
          Having trouble? Use a recovery code or contact IT support. {" "}
          <Link href="/login" className="font-semibold text-[#014171] hover:underline">Return to sign in</Link>
        </p>
      </div>
    </main>
  );
}
