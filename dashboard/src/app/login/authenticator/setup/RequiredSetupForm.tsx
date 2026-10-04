"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Clipboard, Download, LoaderCircle, ShieldCheck } from "lucide";
import { MorphIcon } from "morphicons/react";
import OtpInput from "@/components/ui/OtpInput";
import {
  completeRequiredMfaEnrollmentAction,
  confirmRequiredMfaEnrollmentAction,
  type VerifyMfaState,
} from "../actions";

const INITIAL_STATE: VerifyMfaState = {};

function ConfirmationFields({ error }: { error?: string }) {
  const { pending } = useFormStatus();
  const [code, setCode] = useState("");
  return (
    <>
      {error ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      <p className="block text-sm font-semibold text-slate-700">Verification code</p>
      <div className="mt-3">
        <OtpInput name="code" value={code} onChange={setCode} disabled={pending} autoFocus status={error ? "error" : "idle"} />
      </div>
      <button type="submit" disabled={pending} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2 disabled:opacity-65">
        <MorphIcon icon={pending ? LoaderCircle : ShieldCheck} size={17} strokeWidth={2} reducedMotion="user" className={pending ? "animate-spin" : ""} />
        {pending ? "Enabling…" : "Enable authenticator"}
      </button>
    </>
  );
}

export default function RequiredSetupForm({ qrDataUrl, manualSecret }: { qrDataUrl: string | null; manualSecret: string | null }) {
  const [state, action] = useActionState(confirmRequiredMfaEnrollmentAction, INITIAL_STATE);
  const [copied, setCopied] = useState(false);

  if (state.success && state.recoveryCodes) {
    const recoveryText = state.recoveryCodes.join("\n");
    return (
      <div className="mt-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <p className="font-semibold">Authenticator enabled</p>
          <p className="mt-1">Save these recovery codes now. They will not be shown again.</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm sm:grid-cols-2">
          {state.recoveryCodes.map((code) => <code key={code}>{code}</code>)}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={async () => { await navigator.clipboard.writeText(recoveryText); setCopied(true); }} className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <MorphIcon icon={copied ? Check : Clipboard} size={16} strokeWidth={2} reducedMotion="user" />
            {copied ? "Copied" : "Copy codes"}
          </button>
          <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`SEA Print recovery codes\n\n${recoveryText}\n`)}`} download="sea-print-recovery-codes.txt" className="flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            <MorphIcon icon={Download} size={16} strokeWidth={2} reducedMotion="user" /> Download codes
          </a>
        </div>
        <form action={completeRequiredMfaEnrollmentAction}>
          <button type="submit" className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#014171] px-4 py-3 text-sm font-semibold text-white hover:bg-[#012c50]">I saved my codes — continue</button>
        </form>
      </div>
    );
  }

  if (!qrDataUrl || !manualSecret) {
    return (
      <form action={completeRequiredMfaEnrollmentAction} className="mt-6">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Authenticator setup is complete, but the one-time recovery-code display was interrupted. Continue, then generate a new set from Account → Security settings.
        </div>
        <button type="submit" className="mt-5 flex min-h-11 w-full items-center justify-center rounded-xl bg-[#014171] px-4 py-3 text-sm font-semibold text-white hover:bg-[#012c50]">Continue to SEA Print</button>
      </form>
    );
  }

  return (
    <div className="mt-6">
      <ol className="space-y-5">
        <li>
          <p className="text-sm font-semibold text-slate-800">1. Scan this QR code</p>
          <div className="mt-3 flex justify-center rounded-2xl border border-slate-200 bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="Authenticator setup QR code" className="size-52" />
          </div>
          <details className="mt-2 text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold text-[#014171]">Cannot scan the code?</summary>
            <p className="mt-2">Enter this setup key manually:</p>
            <code className="mt-1 block break-all rounded-lg bg-slate-100 p-2 font-mono text-slate-700">{manualSecret}</code>
          </details>
        </li>
        <li>
          <p className="text-sm font-semibold text-slate-800">2. Confirm the current code</p>
          <form action={action} className="mt-3" noValidate>
            <ConfirmationFields error={state.error} />
          </form>
        </li>
      </ol>
    </div>
  );
}
