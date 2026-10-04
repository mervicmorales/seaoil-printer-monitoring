"use client";

import { Eye, EyeOff, KeyRound, X } from "lucide";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { gooeyToast } from "goey-toast";
import { IconGlyph } from "@/components/ui";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import {
  setTemporaryPasswordAction,
  type TemporaryPasswordState,
} from "./actions";

const EMPTY_RESULT: TemporaryPasswordState = {};

export default function TemporaryPasswordDialog({
  userId,
  userName,
  compact = false,
}: {
  userId: number;
  userName: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [result, setResult] = useState<TemporaryPasswordState>(EMPTY_RESULT);
  const [pending, startTransition] = useTransition();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  useBodyScrollLock(open);

  const closeDialog = useCallback(() => {
    if (pending) return;
    setOpen(false);
    setShowPassword(false);
    setResult(EMPTY_RESULT);
    formRef.current?.reset();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => passwordRef.current?.focus());
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        closeDialog();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
      ) ?? []);
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeDialog, open, pending]);

  function submitTemporaryPassword(formData: FormData) {
    if (pending) return;
    setResult(EMPTY_RESULT);
    startTransition(async () => {
      try {
        const nextResult = await setTemporaryPasswordAction(formData);
        setResult(nextResult);
        if (nextResult.success) {
          formRef.current?.reset();
          setShowPassword(false);
          gooeyToast.success("Temporary password saved", {
            id: `temporary-password-${userId}`,
            description: "Existing sessions were signed out. Give the password directly to the user.",
          });
        } else {
          window.requestAnimationFrame(() => {
            formRef.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus();
          });
        }
      } catch {
        setResult({ error: "The temporary password could not be saved. Please try again." });
      }
    });
  }

  const inputClass = "mt-1.5 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40 disabled:bg-slate-100";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={compact
          ? "rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-[#014171] transition hover:bg-sky-100"
          : "rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-[#014171] transition hover:bg-sky-100"}
      >
        Set Temporary Password
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="temporary-password-title"
            className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
                  <IconGlyph icon={KeyRound} size={20} />
                </span>
                <div>
                  <h2 id="temporary-password-title" className="text-lg font-bold text-[#014171]">
                    Set temporary password
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">For {userName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                disabled={pending}
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 disabled:opacity-60"
              >
                <IconGlyph icon={X} size={18} />
              </button>
            </div>

            <div className="p-6">
              {!result.success ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  This password expires in 24 hours and signs out the user&apos;s existing sessions. On sign-in, they will be asked to create a permanent password or skip for that session.
                </div>
              ) : null}

              {result.error ? (
                <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {result.error}
                </div>
              ) : null}
              {result.success ? (
                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-6 text-emerald-800">
                  Temporary password saved. Give it directly to the user; no email was sent.
                </div>
              ) : null}

              {!result.success ? (
                <form ref={formRef} action={submitTemporaryPassword} className="mt-5 space-y-4" noValidate>
                  <input type="hidden" name="id" value={userId} />
                  <label className="block text-sm font-semibold text-slate-700">
                    Temporary password
                    <span className="relative block">
                      <input
                        ref={passwordRef}
                        name="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        disabled={pending}
                        aria-invalid={Boolean(result.fieldErrors?.password) || undefined}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute right-1.5 top-[0.6rem] flex size-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <IconGlyph icon={showPassword ? EyeOff : Eye} size={18} />
                      </button>
                    </span>
                    {result.fieldErrors?.password ? (
                      <span className="mt-1 block text-xs font-normal text-red-600">{result.fieldErrors.password}</span>
                    ) : (
                      <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
                        Use 8+ characters with an uppercase letter, number, and special character.
                      </span>
                    )}
                  </label>

                  <label className="block text-sm font-semibold text-slate-700">
                    Confirm temporary password
                    <input
                      name="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      disabled={pending}
                      aria-invalid={Boolean(result.fieldErrors?.confirmPassword) || undefined}
                      className={inputClass}
                    />
                    {result.fieldErrors?.confirmPassword ? (
                      <span className="mt-1 block text-xs font-normal text-red-600">{result.fieldErrors.confirmPassword}</span>
                    ) : null}
                  </label>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" onClick={closeDialog} disabled={pending} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                      Cancel
                    </button>
                    <button type="submit" disabled={pending} className="rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#012c50] disabled:cursor-not-allowed disabled:opacity-60">
                      {pending ? "Saving…" : "Save password"}
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" onClick={closeDialog} className="mt-5 w-full rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#012c50]">
                  Done
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
