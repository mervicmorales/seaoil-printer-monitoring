"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowLeft, Building2, KeyRound, LoaderCircle, Mail, MailCheck, Send, UserRound } from "lucide";
import { MorphIcon } from "morphicons/react";
import { gooeyToast } from "goey-toast";
import SearchableSelect from "@/components/SearchableSelect";
import { Input, PrimaryButton } from "@/components/ui";
import { registerAction, resendVerificationAction, type RegistrationState } from "./actions";

async function submitRegistration(previous: RegistrationState, formData: FormData): Promise<RegistrationState> {
  let result: RegistrationState;
  try {
    result = await registerAction(previous, formData);
  } catch {
    result = { error: "We could not confirm your registration. Please try again or contact IT support." };
  }

  const validationError = Object.values(result.fieldErrors ?? {}).find(Boolean);
  if (result.error || validationError) {
    gooeyToast.error("Registration could not be completed", {
      id: "registration-result",
      description: result.error || validationError,
    });
  } else if (result.success) {
    gooeyToast.success("Registration request submitted", {
      id: "registration-result",
      description: result.success,
    });
  }

  return result;
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <PrimaryButton type="submit" disabled={pending} className="min-w-36 px-5">
      <MorphIcon
        icon={pending ? LoaderCircle : Send}
        size={16}
        strokeWidth={2}
        reducedMotion="user"
        className={pending ? "animate-spin" : ""}
      />
      {pending ? "Submitting…" : "Submit request"}
    </PrimaryButton>
  );
}

const RESEND_COOLDOWN_STORAGE_KEY = "registration-resend-cooldown-until";
const RESEND_COOLDOWN_EVENT = "registration-resend-cooldown-updated";

function publishResendCooldown(cooldownUntil: number) {
  window.localStorage.setItem(RESEND_COOLDOWN_STORAGE_KEY, String(cooldownUntil));
  window.dispatchEvent(new CustomEvent<number>(RESEND_COOLDOWN_EVENT, { detail: cooldownUntil }));
}

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ResendSubmit({ remainingSeconds }: { remainingSeconds: number }) {
  const { pending } = useFormStatus();
  const disabled = pending || remainingSeconds > 0;

  return (
    <PrimaryButton type="submit" disabled={disabled}>
      <MorphIcon
        icon={pending ? LoaderCircle : MailCheck}
        size={16}
        strokeWidth={2}
        reducedMotion="user"
        className={pending ? "animate-spin" : ""}
      />
      {pending
        ? "Sending…"
        : remainingSeconds > 0
          ? `Resend in ${formatCountdown(remainingSeconds)}`
          : "Resend email"}
    </PrimaryButton>
  );
}

export default function RegisterForm({ locations, departments }: { locations: { id: number; name: string }[]; departments: { id: number; name: string }[] }) {
  const [state, action] = useActionState<RegistrationState, FormData>(submitRegistration, {});

  useEffect(() => {
    if (state.cooldownUntil) publishResendCooldown(state.cooldownUntil);
  }, [state.cooldownUntil]);

  return (
    <form action={action} className="space-y-7">
      <FormSection icon={UserRound} title="Employee information" description="Enter the details shown on your company records.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="registration-full-name" label="Full Name" name="fullName" autoComplete="name" required error={state.fieldErrors?.fullName} />
          <Input id="registration-employee-id" label="Employee ID" name="employeeId" placeholder="SPI00001" autoComplete="off" required error={state.fieldErrors?.employeeId} />
        </div>
        <Input id="registration-email" label="SEAOIL Email" name="email" type="email" placeholder="name@seaoil.com.ph" autoComplete="email" required error={state.fieldErrors?.email} />
      </FormSection>

      <FormSection icon={Building2} title="Work assignment" description="Select your primary office location and department.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SearchableSelect
            label="Location"
            name="primaryLocationId"
            options={locations}
            placeholder="Search location..."
            required
            error={state.fieldErrors?.primaryLocationId}
          />
          <SearchableSelect
            label="Department"
            name="departmentId"
            options={departments}
            placeholder="Search department..."
            required
            error={state.fieldErrors?.departmentId}
          />
        </div>
      </FormSection>

      <FormSection icon={KeyRound} title="Account security" description="Choose the password you will use after approval.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input id="registration-password" label="Password" name="password" type="password" autoComplete="new-password" required error={state.fieldErrors?.password} />
          <Input id="registration-confirm-password" label="Confirm Password" name="confirmPassword" type="password" autoComplete="new-password" required error={state.fieldErrors?.confirmPassword} />
        </div>
      </FormSection>

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/login" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#014171]">
          <MorphIcon icon={ArrowLeft} size={16} strokeWidth={2} reducedMotion="user" />
          Back to sign in
        </Link>
        <Submit />
      </div>
    </form>
  );
}

export function ResendVerificationForm() {
  const [state, action] = useActionState<RegistrationState, FormData>(resendVerificationAction, {});
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    function handleCooldownUpdate(event: Event) {
      const cooldownEvent = event as CustomEvent<number>;
      setCooldownUntil(cooldownEvent.detail);
      setNow(Date.now());
    }

    window.addEventListener(RESEND_COOLDOWN_EVENT, handleCooldownUpdate);
    const timer = window.setTimeout(() => {
      const storedCooldown = Number(window.localStorage.getItem(RESEND_COOLDOWN_STORAGE_KEY));
      const currentTime = Date.now();
      setNow(currentTime);
      if (Number.isFinite(storedCooldown) && storedCooldown > currentTime) {
        setCooldownUntil(storedCooldown);
      } else {
        window.localStorage.removeItem(RESEND_COOLDOWN_STORAGE_KEY);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(RESEND_COOLDOWN_EVENT, handleCooldownUpdate);
    };
  }, []);

  useEffect(() => {
    if (state.error) {
      gooeyToast.error("Verification email could not be sent", {
        id: "registration-resend-result",
        description: state.error,
      });
    } else if (state.success) {
      gooeyToast.success("Verification email requested", {
        id: "registration-resend-result",
        description: state.success,
      });
    }
  }, [state]);

  useEffect(() => {
    if (!state.cooldownUntil) return;
    const timer = window.setTimeout(() => {
      publishResendCooldown(state.cooldownUntil!);
      setCooldownUntil(state.cooldownUntil!);
      setNow(Date.now());
    }, 0);
    return () => window.clearTimeout(timer);
  }, [state.cooldownUntil]);

  useEffect(() => {
    if (cooldownUntil <= 0) return;
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      if (currentTime >= cooldownUntil) {
        window.localStorage.removeItem(RESEND_COOLDOWN_STORAGE_KEY);
        window.clearInterval(timer);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const remainingSeconds = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));

  return (
    <form action={action} className="mt-8 rounded-2xl border border-[#dfe6ee] bg-slate-50/70 p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#014171]/8 text-[#014171]">
          <MorphIcon icon={Mail} size={17} strokeWidth={2} reducedMotion="user" />
        </span>
        <div>
          <p className="text-sm font-bold text-[#014171]">Need another verification email?</p>
          <p className="mt-0.5 text-xs leading-5 text-slate-500">Enter the same SEAOIL email used for registration.</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-label="Registered SEAOIL email"
          placeholder="name@seaoil.com.ph"
          className="min-h-10 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15"
        />
        <ResendSubmit remainingSeconds={remainingSeconds} />
      </div>
      {remainingSeconds > 0 && (
        <p aria-live="polite" className="mt-3 text-xs font-medium text-amber-700">
          You can request another verification email in {formatCountdown(remainingSeconds)}.
        </p>
      )}
    </form>
  );
}

function FormSection({
  icon,
  title,
  description,
  children,
}: {
  icon: typeof UserRound;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#014171]/8 text-[#014171]">
          <MorphIcon icon={icon} size={17} strokeWidth={2} reducedMotion="user" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-800">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
        {children}
      </div>
    </section>
  );
}
