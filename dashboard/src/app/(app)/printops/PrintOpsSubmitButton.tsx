"use client";

import { useFormStatus } from "react-dom";

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
      className="inline-flex items-center justify-center rounded-lg bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#012c50] disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
