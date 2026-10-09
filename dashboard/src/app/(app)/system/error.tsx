"use client";

import Link from "next/link";
import { AlertTriangle, Building2, RefreshCw } from "lucide";
import { IconGlyph } from "@/components/ui";

export default function SystemError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[28rem] max-w-3xl items-center justify-center px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-[0_18px_50px_rgba(15,23,42,0.08)] sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
          <IconGlyph icon={AlertTriangle} size={23} />
        </span>
        <p className="mt-5 text-xs font-bold uppercase tracking-[0.14em] text-[#4f7fa9]">System settings</p>
        <h1 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[#014171]">This settings page could not load</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">
          Your navigation and account are still available. Retry the page, or continue to Organization Data while the problem is investigated.
        </p>
        {error.digest && <p className="mt-3 font-mono text-xs text-slate-400">Reference: {error.digest}</p>}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button type="button" onClick={reset} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#014171] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#00365f] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]">
            <IconGlyph icon={RefreshCw} size={16} />
            Retry
          </button>
          <Link href="/system/organization" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]">
            <IconGlyph icon={Building2} size={16} />
            Organization Data
          </Link>
        </div>
      </section>
    </div>
  );
}
