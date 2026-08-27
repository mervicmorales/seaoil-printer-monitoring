"use client";

import { useFormStatus } from "react-dom";

export default function PrintOpsRefreshButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Queueing…" : "Refresh agent data"}
    </button>
  );
}
