"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide";
import { MorphIcon } from "morphicons/react";
import { PASSWORD_RULE_TEXT } from "@/lib/validation";
import { resetPasswordAction, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
    >
      <MorphIcon
        icon={pending ? LoaderCircle : LockKeyhole}
        size={17}
        strokeWidth={2}
        reducedMotion="user"
        className={pending ? "animate-spin" : ""}
      />
      {pending ? "Updating…" : "Update password"}
    </button>
  );
}

function PasswordField({
  id,
  name,
  label,
  error,
  autoFocus,
}: {
  id: string;
  name: string;
  label: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          autoFocus={autoFocus}
          required
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 pr-11 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40"
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-1 flex w-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0]"
        >
          <MorphIcon icon={visible ? EyeOff : Eye} size={18} strokeWidth={2} reducedMotion="user" />
        </button>
      </div>
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, initialState);
  return (
    <form action={action} className="mt-6 space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />
      {state.error ? (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <PasswordField
        id="new-password"
        name="password"
        label="New password"
        error={state.fieldErrors?.password}
        autoFocus
      />
      <PasswordField
        id="confirm-password"
        name="confirmPassword"
        label="Confirm password"
        error={state.fieldErrors?.confirmPassword}
      />
      <p className="text-xs leading-5 text-slate-500">{PASSWORD_RULE_TEXT}</p>
      <SubmitButton />
    </form>
  );
}
