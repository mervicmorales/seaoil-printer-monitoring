import { db } from "@/db";
import { systemSettings } from "@/db/schema";
import LoginForm from "./LoginForm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; verified?: string }>;
}) {
  const params = await searchParams;
  const [settings] = await db
    .select({ logoUrl: systemSettings.logoUrl })
    .from(systemSettings)
    .limit(1);
  const logoUrl = settings?.logoUrl ?? null;

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-[#014171] p-12 text-white lg:flex">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#7DA8D0]/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-[#FEF200]/20 blur-3xl" />
        <div className="relative z-10 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl text-xl font-black text-[#014171] ${
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
            <p className="text-lg font-bold leading-tight">SEAOIL</p>
            <p className="text-xs uppercase tracking-[0.2em] text-[#7DA8D0]">
              Philippines Inc.
            </p>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-bold leading-tight">
            Printer Management System
          </h1>
          <p className="mt-4 max-w-md text-sm text-[#cfe0f2]">
            Centralized tracking for printers, toner inventory, contracts and
            repair tickets across all SEAOIL locations.
          </p>
        </div>
        <p className="relative z-10 text-xs text-[#a9c4e0]">
          For internal use by SEAOIL Philippines Inc. only.
        </p>
      </section>

      <section className="flex items-center justify-center bg-[#f4f6f9] px-6 py-12">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl sm:p-10">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div
              className={`flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-lg font-black text-[#FEF200] ${
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
            <p className="text-lg font-bold text-[#014171]">SEAOIL Printer Monitoring</p>
          </div>
          <h2 className="text-2xl font-bold text-[#014171]">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">
            Sign in to manage printers, toner and repair tickets.
          </p>

          {params.verified === "account-activated" && (
            <p className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              Your email has been verified and your account is now active. You can sign in.
            </p>
          )}
          {params.verified === "1" && (
            <p className="mt-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-700">
              Your email has been verified. Your registration is now awaiting administrator approval.
            </p>
          )}
          {(params.verified === "0" || params.verified === "invalid") && (
            <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              This verification link is invalid, expired, or has already been used.
            </p>
          )}

          <LoginForm nextPath={params.next ?? "/dashboard"} />
          <p className="mt-5 text-center text-sm text-slate-500">SEAOIL employee? <Link href="/register" className="font-medium text-[#014171] hover:underline">Request access</Link></p>
        </div>
      </section>
    </main>
  );
}
