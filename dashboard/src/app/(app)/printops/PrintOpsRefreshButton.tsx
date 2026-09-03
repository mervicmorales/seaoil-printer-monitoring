"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle, RefreshCw } from "lucide";
import { MorphIcon } from "morphicons/react";

export default function PrintOpsRefreshButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
    >
      <MorphIcon
        icon={pending ? LoaderCircle : RefreshCw}
        size={13}
        strokeWidth={2}
        reducedMotion="user"
        className={pending ? "animate-spin" : ""}
      />
      {pending ? "Queueing…" : "Refresh agent data"}
    </button>
  );
}
