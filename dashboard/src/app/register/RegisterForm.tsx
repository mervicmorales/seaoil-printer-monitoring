"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Input, PrimaryButton, Select } from "@/components/ui";
import { registerAction, resendVerificationAction, type RegistrationState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return <PrimaryButton type="submit" disabled={pending}>{pending ? "Submitting..." : "Register"}</PrimaryButton>;
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
      {pending
        ? "Sending..."
        : remainingSeconds > 0
          ? `Resend in ${formatCountdown(remainingSeconds)}`
          : "Resend"}
    </PrimaryButton>
  );
}

export default function RegisterForm({ locations, departments }: { locations: { id: number; name: string }[]; departments: { id: number; name: string }[] }) {
  const [state, action] = useActionState<RegistrationState, FormData>(registerAction, {});

  useEffect(() => {
    if (state.cooldownUntil) publishResendCooldown(state.cooldownUntil);
  }, [state.cooldownUntil]);

  return <form action={action} className="space-y-4">
    {state.success && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{state.success}</div>}
    {state.error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{state.error}</div>}
    <Input label="Full Name" name="fullName" required error={state.fieldErrors?.fullName} />
    <Input label="Employee ID" name="employeeId" placeholder="SPI00001" required error={state.fieldErrors?.employeeId} />
    <Input label="SEAOIL Email" name="email" type="email" placeholder="name@seaoil.com.ph" required error={state.fieldErrors?.email} />
    <div className="grid gap-4 sm:grid-cols-2">
      <Select label="Location" name="primaryLocationId" required error={state.fieldErrors?.primaryLocationId}><option value="">Select location</option>{locations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
      <Select label="Department" name="departmentId" required error={state.fieldErrors?.departmentId}><option value="">Select department</option>{departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    </div>
    <Input label="Password" name="password" type="password" required error={state.fieldErrors?.password} />
    <Input label="Confirm Password" name="confirmPassword" type="password" required error={state.fieldErrors?.confirmPassword} />
    <div className="flex items-center justify-between"><Submit /><Link href="/login" className="text-sm text-[#014171] hover:underline">Back to login</Link></div>
  </form>;
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
    <form action={action} className="mt-6 border-t pt-6">
      <p className="mb-3 text-sm font-semibold text-[#014171]">Resend verification email</p>
      <div className="flex gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="name@seaoil.com.ph"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <ResendSubmit remainingSeconds={remainingSeconds} />
      </div>
      {state.success && <p className="mt-2 text-xs text-slate-500">{state.success}</p>}
      {remainingSeconds > 0 && (
        <p aria-live="polite" className="mt-2 text-xs font-medium text-amber-700">
          You can request another verification email in {formatCountdown(remainingSeconds)}.
        </p>
      )}
    </form>
  );
}
