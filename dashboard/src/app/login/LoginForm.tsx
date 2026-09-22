"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { AtSign, Eye, EyeOff, LoaderCircle, LockKeyhole, LogIn } from "lucide";
import { MorphIcon } from "morphicons/react";
import { gooeyToast } from "goey-toast";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

function LoginFields({ state, nextPath }: { state: LoginState; nextPath: string }) {
  const { pending } = useFormStatus();
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (state.fieldErrors?.identifier) {
      identifierRef.current?.focus();
    } else if (state.fieldErrors?.password || state.error) {
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  }, [state.error, state.fieldErrors]);

  return (
    <>
      <input type="hidden" name="next" value={nextPath} />

      <div className="space-y-5">
        <div>
          <label htmlFor="login-identifier" className="mb-1.5 block text-sm font-semibold text-slate-700">
            Email or Username <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400">
              <MorphIcon icon={AtSign} size={17} strokeWidth={2} reducedMotion="user" />
            </span>
            <input
              ref={identifierRef}
              id="login-identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              inputMode="email"
              required
              disabled={pending}
              aria-invalid={Boolean(state.fieldErrors?.identifier) || undefined}
              aria-describedby={state.fieldErrors?.identifier ? "login-identifier-error" : undefined}
              placeholder="you@seaoil.com.ph"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-3.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>
          {state.fieldErrors?.identifier ? (
            <p id="login-identifier-error" className="mt-1.5 text-xs text-red-600">
              {state.fieldErrors.identifier}
            </p>
          ) : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-4">
            <label htmlFor="login-password" className="text-sm font-semibold text-slate-700">
              Password <span className="text-red-500">*</span>
            </label>
            <Link
              href="/forgot-password"
              className="rounded-sm text-xs font-semibold text-[#014171] hover:underline focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex w-11 items-center justify-center text-slate-400">
              <MorphIcon icon={LockKeyhole} size={17} strokeWidth={2} reducedMotion="user" />
            </span>
            <input
              ref={passwordRef}
              id="login-password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              disabled={pending}
              aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
              aria-describedby={state.fieldErrors?.password ? "login-password-error" : undefined}
              placeholder="Enter your password"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-12 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:bg-slate-100 disabled:text-slate-500"
            />
            <button
              type="button"
              disabled={pending}
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              className="absolute inset-y-0 right-1 flex w-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:opacity-50"
            >
              <MorphIcon icon={showPassword ? EyeOff : Eye} size={18} strokeWidth={2} reducedMotion="user" />
            </button>
          </div>
          {state.fieldErrors?.password ? (
            <p id="login-password-error" className="mt-1.5 text-xs text-red-600">
              {state.fieldErrors.password}
            </p>
          ) : null}
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <MorphIcon
          icon={pending ? LoaderCircle : LogIn}
          size={17}
          strokeWidth={2}
          reducedMotion="user"
          className={pending ? "animate-spin" : ""}
        />
        {pending ? "Signing in…" : "Sign In"}
      </button>

      <span className="sr-only" aria-live="polite">
        {pending ? "Signing in" : ""}
      </span>
    </>
  );
}

export default function LoginForm({ nextPath = "/overview" }: { nextPath?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  useEffect(() => {
    if (!state.error) return;
    gooeyToast.error("Sign in failed", {
      id: "login-result",
      description: state.error,
    });
  }, [state]);

  return (
    <form action={formAction} className="mt-6 space-y-5" noValidate>
      <LoginFields state={state} nextPath={nextPath} />
    </form>
  );
}
