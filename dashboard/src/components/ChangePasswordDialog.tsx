"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { gooeyToast } from "goey-toast";
import { Eye, EyeOff } from "lucide";
import {
  changePasswordAction,
  type ChangePasswordResult,
} from "@/app/(app)/shell-actions";
import { IconGlyph } from "@/components/ui";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

const EMPTY_RESULT: ChangePasswordResult = {};

export default function ChangePasswordDialog({
  open,
  onClose,
  triggerRef,
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const [result, setResult] = useState<ChangePasswordResult>(EMPTY_RESULT);
  const [visibleFields, setVisibleFields] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [pending, startTransition] = useTransition();
  const pendingRef = useRef(pending);
  const dialogRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    if (!open) return;
    formRef.current?.reset();
    const focusFrame = window.requestAnimationFrame(() => currentPasswordRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !pendingRef.current) {
        event.preventDefault();
        setResult(EMPTY_RESULT);
        onClose();
        window.requestAnimationFrame(() => triggerRef.current?.focus());
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
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
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open, triggerRef]);

  if (!open) return null;

  function closeDialog() {
    if (pending) return;
    setResult(EMPTY_RESULT);
    setVisibleFields({ currentPassword: false, newPassword: false, confirmPassword: false });
    onClose();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function submitPassword(formData: FormData) {
    if (pending) return;
    setResult(EMPTY_RESULT);
    startTransition(async () => {
      try {
        const nextResult = await changePasswordAction(formData);
        if (!nextResult.success) {
          setResult(nextResult);
          window.requestAnimationFrame(() => {
            const firstInvalid = formRef.current?.querySelector<HTMLInputElement>(
              '[aria-invalid="true"]',
            );
            firstInvalid?.focus();
          });
          return;
        }

        gooeyToast.success("Password changed", {
          id: "account-password-changed",
          description: "Your new password is ready to use the next time you sign in.",
        });
        setResult(EMPTY_RESULT);
        setVisibleFields({ currentPassword: false, newPassword: false, confirmPassword: false });
        formRef.current?.reset();
        onClose();
        window.requestAnimationFrame(() => triggerRef.current?.focus());
      } catch {
        setResult({ error: "The password could not be changed. Please try again." });
      }
    });
  }

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-11 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40 disabled:bg-slate-100";

  function toggleVisibility(field: keyof typeof visibleFields) {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  }

  function visibilityButton(field: keyof typeof visibleFields, label: string) {
    const visible = visibleFields[field];
    return (
      <button
        type="button"
        onClick={() => toggleVisibility(field)}
        disabled={pending}
        aria-label={`${visible ? "Hide" : "Show"} ${label}`}
        className="absolute right-1.5 top-[0.6rem] flex size-9 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:opacity-50"
      >
        <IconGlyph icon={visible ? EyeOff : Eye} size={18} />
      </button>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-password-title"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <h2 id="change-password-title" className="text-xl font-bold text-[#014171]">
          Change password
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Confirm your current password, then enter a new one.
        </p>

        {result.error ? (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {result.error}
          </div>
        ) : null}

        <form ref={formRef} action={submitPassword} className="mt-5 space-y-4" noValidate>
          <label className="block text-sm font-medium text-slate-700">
            Current password
            <span className="relative block">
              <input
                ref={currentPasswordRef}
                name="currentPassword"
                type={visibleFields.currentPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={pending}
                aria-invalid={Boolean(result.fieldErrors?.currentPassword) || undefined}
                className={inputClass}
              />
              {visibilityButton("currentPassword", "current password")}
            </span>
            {result.fieldErrors?.currentPassword ? (
              <span className="mt-1 block text-xs text-red-600">{result.fieldErrors.currentPassword}</span>
            ) : null}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            New password
            <span className="relative block">
              <input
                name="newPassword"
                type={visibleFields.newPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                disabled={pending}
                aria-invalid={Boolean(result.fieldErrors?.newPassword) || undefined}
                className={inputClass}
              />
              {visibilityButton("newPassword", "new password")}
            </span>
            {result.fieldErrors?.newPassword ? (
              <span className="mt-1 block text-xs text-red-600">{result.fieldErrors.newPassword}</span>
            ) : (
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                Use 8+ characters with an uppercase letter, number, and special character.
              </span>
            )}
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Re-type new password
            <span className="relative block">
              <input
                name="confirmPassword"
                type={visibleFields.confirmPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                disabled={pending}
                aria-invalid={Boolean(result.fieldErrors?.confirmPassword) || undefined}
                className={inputClass}
              />
              {visibilityButton("confirmPassword", "password confirmation")}
            </span>
            {result.fieldErrors?.confirmPassword ? (
              <span className="mt-1 block text-xs text-red-600">{result.fieldErrors.confirmPassword}</span>
            ) : null}
          </label>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={closeDialog}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#012c50] focus:outline-none focus:ring-2 focus:ring-[#7DA8D0] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {pending ? "Saving…" : "Change password"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
