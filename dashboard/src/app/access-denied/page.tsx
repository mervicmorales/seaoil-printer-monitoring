import Link from "next/link";

export default function AccessDeniedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f9] px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-3xl">
          🚫
        </div>
        <h1 className="text-2xl font-bold text-[#014171]">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          You do not have permission to view this page. Please contact your
          system administrator if you believe this is an error.
        </p>
        <Link
          href="/overview"
          className="mt-6 inline-flex items-center justify-center rounded-lg bg-[#014171] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#012c50]"
        >
          Back to Overview
        </Link>
      </div>
    </main>
  );
}
