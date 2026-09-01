"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { LoaderCircle, Mail } from "lucide";
import { MorphIcon } from "morphicons/react";
import {
  requestPasswordResetAction,
  type ForgotPasswordState,
} from "./actions";

const initialState: ForgotPasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <MorphIcon
        icon={pending ? LoaderCircle : Mail}
        size={17}
        strokeWidth={2}
        reducedMotion="user"
        className={pending ? "animate-spin" : ""}
      />
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}

export default function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={action} className="mt-6 space-y-5" noValidate>
      {state.success ? (
        <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {state.success}
        </p>
      ) : null}

      <div>
        <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-slate-700">
          Email address <span className="text-red-500">*</span>
        </label>
        <input
          id="reset-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          required
          aria-invalid={Boolean(state.fieldErrors?.email) || undefined}
          aria-describedby={state.fieldErrors?.email ? "reset-email-error" : undefined}
          placeholder="you@seaoil.com.ph"
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40"
        />
        {state.fieldErrors?.email ? (
          <p id="reset-email-error" className="mt-1 text-xs text-red-600">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <SubmitButton />
    </form>
  );
}
