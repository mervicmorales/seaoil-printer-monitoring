"use client";

import { useFormStatus } from "react-dom";
import { LoaderCircle } from "lucide";
import { MorphIcon } from "morphicons/react";

export default function PrintOpsSubmitButton({
  idleLabel,
  pendingLabel,
}: {
  idleLabel: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md active:translate-y-px disabled:cursor-wait disabled:opacity-60 sm:w-auto"
    >
      {pending && <MorphIcon icon={LoaderCircle} size={15} strokeWidth={2} reducedMotion="user" className="animate-spin" />}
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
