"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, LoaderCircle, LogIn } from "lucide";
import { MorphIcon } from "morphicons/react";
import AuthBlob, { type BlobMood } from "@/components/AuthBlob";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = {};

function LoginFields({ state, nextPath }: { state: LoginState; nextPath: string }) {
  const { pending } = useFormStatus();
  const router = useRouter();
  const identifierRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [focusedField, setFocusedField] = useState<"identifier" | "password" | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const hasError = Boolean(state.error || Object.keys(state.fieldErrors ?? {}).length);
  const mood: BlobMood = pending
    ? "thinking"
    : state.success
      ? "success"
      : hasError
        ? "concerned"
        : focusedField
          ? "focused"
          : "idle";

  useEffect(() => {
    if (!state.success || !state.redirectTo) return;
    const destination = state.redirectTo;
    const timeout = window.setTimeout(() => router.replace(destination), 220);
    return () => window.clearTimeout(timeout);
  }, [router, state.redirectTo, state.success]);

  useEffect(() => {
    if (state.success) return;
    if (state.fieldErrors?.identifier) {
      identifierRef.current?.focus();
    } else if (state.fieldErrors?.password || state.error) {
      passwordRef.current?.focus();
      passwordRef.current?.select();
    }
  }, [state.error, state.fieldErrors, state.success]);

  return (
    <>
      <input type="hidden" name="next" value={nextPath} />
      <AuthBlob
        mood={mood}
        size={150}
        sensitive={focusedField === "password"}
        gaze={focusedField === "identifier" ? { x: 18, y: -5, intensity: 0.75 } : undefined}
        className="mx-auto -mt-3 -mb-1"
      />

      {state.error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="login-identifier" className="mb-1.5 block text-sm font-medium text-slate-700">
          Email or Username <span className="text-red-500">*</span>
        </label>
        <input
          ref={identifierRef}
          id="login-identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          inputMode="email"
          required
          disabled={pending || state.success}
          aria-invalid={Boolean(state.fieldErrors?.identifier) || undefined}
          aria-describedby={state.fieldErrors?.identifier ? "login-identifier-error" : undefined}
          placeholder="you@seaoil.com.ph"
          onFocus={() => setFocusedField("identifier")}
          onBlur={() => setFocusedField(null)}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40 disabled:bg-slate-100 disabled:text-slate-500"
        />
        {state.fieldErrors?.identifier ? (
          <p id="login-identifier-error" className="mt-1 text-xs text-red-600">
            {state.fieldErrors.identifier}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Password <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            ref={passwordRef}
            id="login-password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            disabled={pending || state.success}
            aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
            aria-describedby={state.fieldErrors?.password ? "login-password-error" : undefined}
            placeholder="••••••••"
            onFocus={() => setFocusedField("password")}
            onBlur={() => setFocusedField(null)}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-11 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40 disabled:bg-slate-100 disabled:text-slate-500"
          />
          <button
            type="button"
            disabled={pending || state.success}
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:opacity-50"
          >
            <MorphIcon icon={showPassword ? EyeOff : Eye} size={18} strokeWidth={2} reducedMotion="user" />
          </button>
        </div>
        {state.fieldErrors?.password ? (
          <p id="login-password-error" className="mt-1 text-xs text-red-600">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      <button
        type="submit"
        disabled={pending || state.success}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <MorphIcon
          icon={pending ? LoaderCircle : state.success ? Check : LogIn}
          size={17}
          strokeWidth={2}
          reducedMotion="user"
          className={pending ? "animate-spin" : ""}
        />
        {pending ? "Signing in…" : state.success ? "Signed in" : "Sign In"}
      </button>

      <span className="sr-only" aria-live="polite">
        {pending ? "Signing in" : state.success ? "Sign in successful" : ""}
      </span>
    </>
  );
}

export default function LoginForm({ nextPath = "/dashboard" }: { nextPath?: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-5 space-y-5" noValidate>
      <LoginFields state={state} nextPath={nextPath} />
    </form>
  );
}
