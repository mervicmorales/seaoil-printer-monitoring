"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { KeyRound, LoaderCircle } from "lucide";
import { MorphIcon } from "morphicons/react";
import OtpInput from "@/components/ui/OtpInput";
import { verifyMfaLoginAction, type VerifyMfaState } from "./actions";

const INITIAL_STATE: VerifyMfaState = {};

function Fields({ state }: { state: VerifyMfaState }) {
  const { pending } = useFormStatus();
  const recoveryInputRef = useRef<HTMLInputElement>(null);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [code, setCode] = useState("");

  useEffect(() => {
    if (!state.error) return;
    if (useRecoveryCode) {
      recoveryInputRef.current?.focus();
      recoveryInputRef.current?.select();
    }
  }, [state.error, useRecoveryCode]);

  return (
    <>
      {state.error ? (
        <div role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</div>
      ) : null}
      {useRecoveryCode ? (
        <>
          <label className="block text-sm font-semibold text-slate-700" htmlFor="mfa-recovery-code">Recovery code</label>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-12 items-center justify-center text-slate-400">
              <MorphIcon icon={KeyRound} size={18} strokeWidth={2} reducedMotion="user" />
            </span>
            <input
              ref={recoveryInputRef}
              id="mfa-recovery-code"
              name="credential"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              autoFocus
              disabled={pending}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-4 font-mono text-sm tracking-[0.08em] outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:bg-slate-100"
            />
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">Recovery codes work once and should only be used when your authenticator is unavailable.</p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-slate-700">Authenticator code</p>
          <div className="mt-3">
            <OtpInput name="credential" value={code} onChange={setCode} disabled={pending} autoFocus status={state.error ? "error" : "idle"} />
          </div>
          <p className="mt-3 text-center text-xs leading-5 text-slate-500">Enter the current six-digit code from your authenticator app.</p>
        </>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setUseRecoveryCode((current) => !current);
          setCode("");
        }}
        className="mt-3 w-full rounded-lg py-1 text-xs font-semibold text-[#014171] hover:underline focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:opacity-60"
      >
        {useRecoveryCode ? "Use authenticator code instead" : "Use a recovery code instead"}
      </button>
      <button
        type="submit"
        disabled={pending}
        className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2 disabled:opacity-65"
      >
        <MorphIcon icon={pending ? LoaderCircle : KeyRound} size={17} strokeWidth={2} reducedMotion="user" className={pending ? "animate-spin" : ""} />
        {pending ? "Verifying…" : "Verify and continue"}
      </button>
    </>
  );
}

export default function AuthenticatorForm() {
  const [state, action] = useActionState(verifyMfaLoginAction, INITIAL_STATE);

  return (
    <form action={action} className="mt-6" noValidate>
      <Fields state={state} />
    </form>
  );
}
