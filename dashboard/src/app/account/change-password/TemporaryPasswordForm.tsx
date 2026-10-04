"use client";

import { Eye, EyeOff } from "lucide";
import { useActionState, useState } from "react";
import { IconGlyph } from "@/components/ui";
import {
  changeTemporaryPasswordAction,
  type TemporaryPasswordChangeState,
} from "./actions";

const INITIAL_STATE: TemporaryPasswordChangeState = {};

export default function TemporaryPasswordForm({ nextPath }: { nextPath: string }) {
  const [state, action, pending] = useActionState(changeTemporaryPasswordAction, INITIAL_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40 disabled:bg-slate-100";

  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />
      {state.error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </div>
      ) : null}

      <label className="block text-sm font-semibold text-slate-700">
        New password
        <span className="relative block">
          <input
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            autoFocus
            required
            disabled={pending}
            aria-invalid={Boolean(state.fieldErrors?.password) || undefined}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => setShowPassword((visible) => !visible)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute right-1.5 top-[0.7rem] flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <IconGlyph icon={showPassword ? EyeOff : Eye} size={18} />
          </button>
        </span>
        {state.fieldErrors?.password ? (
          <span className="mt-1 block text-xs font-normal text-red-600">{state.fieldErrors.password}</span>
        ) : (
          <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
            Use 8+ characters with an uppercase letter, number, and special character.
          </span>
        )}
      </label>

      <label className="block text-sm font-semibold text-slate-700">
        Confirm new password
        <input
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          disabled={pending}
          aria-invalid={Boolean(state.fieldErrors?.confirmPassword) || undefined}
          className={inputClass}
        />
        {state.fieldErrors?.confirmPassword ? (
          <span className="mt-1 block text-xs font-normal text-red-600">{state.fieldErrors.confirmPassword}</span>
        ) : null}
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-xl bg-[#014171] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Changing password…" : "Change password"}
      </button>
    </form>
  );
}
