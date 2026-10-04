"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Clipboard, Download, KeyRound, LoaderCircle, RefreshCw, ShieldCheck, ShieldOff } from "lucide";
import { MorphIcon } from "morphicons/react";
import OtpInput from "@/components/ui/OtpInput";
import {
  beginMfaEnrollmentAction,
  confirmMfaEnrollmentAction,
  disableMfaAction,
  regenerateRecoveryCodesAction,
  type AccountMfaState,
} from "./actions";

const EMPTY_STATE: AccountMfaState = {};
const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:bg-slate-100";

function SubmitButton({ icon, idle, pending: pendingText, danger = false }: { icon: typeof ShieldCheck; idle: string; pending: string; danger?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-65 ${danger ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus:ring-red-300" : "bg-[#014171] text-white hover:bg-[#012c50] focus:ring-[#7DA8D0]"}`}>
      <MorphIcon icon={pending ? LoaderCircle : icon} size={17} strokeWidth={2} reducedMotion="user" className={pending ? "animate-spin" : ""} />
      {pending ? pendingText : idle}
    </button>
  );
}

function Feedback({ state }: { state: AccountMfaState }) {
  if (state.error) return <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>;
  if (state.message && !state.recoveryCodes) return <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{state.message}</div>;
  return null;
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
      <p className="font-semibold text-amber-950">Save your recovery codes</p>
      <p className="mt-1 text-sm leading-5 text-amber-800">Each code works once. Store them somewhere private; they will not be displayed again.</p>
      <div className="mt-4 grid gap-2 rounded-xl border border-amber-200 bg-white p-4 font-mono text-sm sm:grid-cols-2">
        {codes.map((code) => <code key={code}>{code}</code>)}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); }} className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
          <MorphIcon icon={copied ? Check : Clipboard} size={16} strokeWidth={2} reducedMotion="user" /> {copied ? "Copied" : "Copy codes"}
        </button>
        <a href={`data:text/plain;charset=utf-8,${encodeURIComponent(`SEA Print recovery codes\n\n${text}\n`)}`} download="sea-print-recovery-codes.txt" className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
          <MorphIcon icon={Download} size={16} strokeWidth={2} reducedMotion="user" /> Download
        </a>
      </div>
    </div>
  );
}

export default function SecurityPanel({
  enabled,
  required,
  enabledAt,
  recoveryCodesRemaining,
  qrDataUrl,
  manualSecret,
}: {
  enabled: boolean;
  required: boolean;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
  qrDataUrl: string | null;
  manualSecret: string | null;
}) {
  const router = useRouter();
  const [beginState, beginAction] = useActionState(beginMfaEnrollmentAction, EMPTY_STATE);
  const [confirmState, confirmAction] = useActionState(confirmMfaEnrollmentAction, EMPTY_STATE);
  const [recoveryState, recoveryAction] = useActionState(regenerateRecoveryCodesAction, EMPTY_STATE);
  const [disableState, disableAction] = useActionState(disableMfaAction, EMPTY_STATE);
  const [enrollmentCode, setEnrollmentCode] = useState("");

  useEffect(() => {
    if (beginState.success || disableState.success) router.refresh();
  }, [beginState.success, disableState.success, router]);

  if (!enabled) {
    if (confirmState.recoveryCodes) return <RecoveryCodes codes={confirmState.recoveryCodes} />;
    if (!qrDataUrl || !manualSecret) {
      return (
        <form action={beginAction} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" noValidate>
          <Feedback state={beginState} />
          <div className="flex items-start gap-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]"><MorphIcon icon={ShieldCheck} size={22} strokeWidth={2} reducedMotion="user" /></span>
            <div>
              <h2 className="font-bold text-slate-900">Set up an authenticator</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">Use Google Authenticator or another TOTP-compatible app. Confirm your password to generate a private setup code.</p>
            </div>
          </div>
          <label htmlFor="begin-mfa-password" className="mt-5 block text-sm font-semibold text-slate-700">Current password</label>
          <input id="begin-mfa-password" name="password" type="password" autoComplete="current-password" className={inputClass} aria-invalid={Boolean(beginState.fieldErrors?.password) || undefined} />
          {beginState.fieldErrors?.password ? <p className="mt-1 text-xs text-red-600">{beginState.fieldErrors.password}</p> : null}
          <div className="mt-5"><SubmitButton icon={ShieldCheck} idle="Start setup" pending="Starting…" /></div>
        </form>
      );
    }

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <Feedback state={confirmState} />
        <h2 className="font-bold text-slate-900">Connect your authenticator app</h2>
        <ol className="mt-4 space-y-5">
          <li>
            <p className="text-sm font-semibold text-slate-700">1. Scan this QR code</p>
            <div className="mt-3 flex justify-center rounded-2xl border border-slate-200 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt="Authenticator setup QR code" className="size-52" />
            </div>
            <details className="mt-2 text-xs text-slate-500">
              <summary className="cursor-pointer font-semibold text-[#014171]">Enter a setup key instead</summary>
              <code className="mt-2 block break-all rounded-lg bg-slate-100 p-2 text-slate-700">{manualSecret}</code>
            </details>
          </li>
          <li>
            <p className="text-sm font-semibold text-slate-700">2. Confirm the current six-digit code</p>
            <form action={confirmAction} className="mt-3" noValidate>
              <OtpInput name="code" value={enrollmentCode} onChange={setEnrollmentCode} autoFocus status={confirmState.error || confirmState.fieldErrors?.code ? "error" : "idle"} />
              {confirmState.fieldErrors?.code ? <p className="mt-1 text-xs text-red-600">{confirmState.fieldErrors.code}</p> : null}
              <div className="mt-4"><SubmitButton icon={ShieldCheck} idle="Enable authenticator" pending="Enabling…" /></div>
            </form>
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {recoveryState.recoveryCodes ? <RecoveryCodes codes={recoveryState.recoveryCodes} /> : null}
      <section className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><MorphIcon icon={ShieldCheck} size={22} strokeWidth={2} reducedMotion="user" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-slate-900">Authenticator enabled</h2>{required ? <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-[#014171]">Required for your role</span> : null}</div>
            <p className="mt-1 text-sm text-slate-500">Enabled {enabledAt ? new Date(enabledAt).toLocaleString() : "for this account"} · {recoveryCodesRemaining} recovery code{recoveryCodesRemaining === 1 ? "" : "s"} remaining</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="font-bold text-slate-900">Create new recovery codes</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">This invalidates every previous recovery code and signs out other sessions.</p>
        <Feedback state={recoveryState} />
        <form action={recoveryAction} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
          <label className="text-sm font-semibold text-slate-700">Current password<input name="password" type="password" autoComplete="current-password" className={inputClass} />{recoveryState.fieldErrors?.password ? <span className="mt-1 block text-xs text-red-600">{recoveryState.fieldErrors.password}</span> : null}</label>
          <label className="text-sm font-semibold text-slate-700">Authenticator or recovery code<input name="code" type="text" autoComplete="one-time-code" className={inputClass} />{recoveryState.fieldErrors?.code ? <span className="mt-1 block text-xs text-red-600">{recoveryState.fieldErrors.code}</span> : null}</label>
          <div className="sm:col-span-2"><SubmitButton icon={RefreshCw} idle="Generate new recovery codes" pending="Generating…" /></div>
        </form>
      </section>

      {!required ? (
        <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="font-bold text-slate-900">Disable authenticator</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">Password-only sign-in will be restored and all recovery codes will be removed.</p>
          <Feedback state={disableState} />
          <form action={disableAction} className="mt-4 grid gap-4 sm:grid-cols-2" noValidate>
            <label className="text-sm font-semibold text-slate-700">Current password<input name="password" type="password" autoComplete="current-password" className={inputClass} />{disableState.fieldErrors?.password ? <span className="mt-1 block text-xs text-red-600">{disableState.fieldErrors.password}</span> : null}</label>
            <label className="text-sm font-semibold text-slate-700">Authenticator or recovery code<input name="code" type="text" autoComplete="one-time-code" className={inputClass} />{disableState.fieldErrors?.code ? <span className="mt-1 block text-xs text-red-600">{disableState.fieldErrors.code}</span> : null}</label>
            <div className="sm:col-span-2"><SubmitButton icon={ShieldOff} idle="Disable authenticator" pending="Disabling…" danger /></div>
          </form>
        </section>
      ) : null}
    </div>
  );
}
