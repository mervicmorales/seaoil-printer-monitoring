"use client";

import { useState } from "react";
import { Activity, Mail, Save, Send, Server, ShieldCheck, type IconNode } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, PrimaryButton, SecondaryButton, Select } from "@/components/ui";

type Settings = { smtpEnabled: boolean; smtpHost: string | null; smtpPort: number | null; smtpSecurity: string; smtpUsername: string | null; smtpFrom: string | null; smtpFromName: string | null; smtpTestRecipient: string | null; smtpLastTestedAt: Date | null; passwordConfigured: boolean };

export default function SmtpSettingsForm({ action, settings }: { action: (formData: FormData) => void | Promise<void>; settings: Settings }) {
  const [status, setStatus] = useState("");
  async function test(send: boolean) {
    setStatus(send ? "Sending..." : "Testing...");
    const response = await fetch("/api/email/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to: settings.smtpTestRecipient || undefined, connectionOnly: !send }) });
    const body = await response.json();
    setStatus(body.message || body.error || "Test failed");
  }
  return (
    <form action={action} className="max-w-4xl space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <MorphIcon icon={Mail} size={18} strokeWidth={2} reducedMotion="user" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-[#014171]">Email delivery</h2>
            <p className="mt-0.5 text-xs text-slate-500">Configure the SMTP server used for automated system messages.</p>
          </div>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${settings.smtpEnabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {settings.smtpEnabled ? "Database SMTP" : "Environment fallback"}
        </span>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5 text-sm text-slate-700">
        <input type="checkbox" name="smtpEnabled" defaultChecked={settings.smtpEnabled} className="mt-0.5 size-4 rounded border-slate-300 text-[#014171] focus:ring-[#014171]/20" />
        <span>
          <span className="block font-semibold">Use saved SMTP settings</span>
          <span className="mt-0.5 block text-xs leading-5 text-slate-500">When disabled, the application uses its environment-based email configuration.</span>
        </span>
      </label>

      <SettingsSection icon={Server} title="Server connection" description="Host, port, transport security, and authentication">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="SMTP Host" name="smtpHost" defaultValue={settings.smtpHost || ""} />
          <Input label="SMTP Port" name="smtpPort" type="number" min="1" max="65535" defaultValue={settings.smtpPort || 1025} />
          <Select label="Security" name="smtpSecurity" defaultValue={settings.smtpSecurity}>
            <option value="none">None</option>
            <option value="starttls">STARTTLS</option>
            <option value="tls">TLS/SSL</option>
          </Select>
          <Input label="Username" name="smtpUsername" defaultValue={settings.smtpUsername || ""} />
          <Input label="Password" name="smtpPassword" type="password" placeholder={settings.passwordConfigured ? "Leave blank to keep current password" : ""} />
          <div className="flex items-end pb-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5"><MorphIcon icon={ShieldCheck} size={14} strokeWidth={2} reducedMotion="user" /> Password configured: <strong className="text-slate-700">{settings.passwordConfigured ? "Yes" : "No"}</strong></span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection icon={Send} title="Sender and testing" description="Message identity and recipient used for delivery checks">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input label="From Email" name="smtpFrom" type="email" defaultValue={settings.smtpFrom || ""} />
          <Input label="From Name" name="smtpFromName" defaultValue={settings.smtpFromName || "SEAOIL Printer"} />
          <Input label="Test Recipient" name="smtpTestRecipient" type="email" defaultValue={settings.smtpTestRecipient || ""} />
        </div>
      </SettingsSection>

      {status && (
        <p aria-live="polite" className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-[#014171]">
          <MorphIcon icon={Activity} size={15} strokeWidth={2} reducedMotion="user" />
          {status}
        </p>
      )}
      {settings.smtpLastTestedAt && <p className="text-xs text-slate-500">Last successful test: {new Date(settings.smtpLastTestedAt).toLocaleString()}</p>}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-5">
        <PrimaryButton type="submit"><MorphIcon icon={Save} size={15} strokeWidth={2} reducedMotion="user" />Save Settings</PrimaryButton>
        <SecondaryButton type="button" onClick={() => void test(false)}><MorphIcon icon={Activity} size={14} strokeWidth={2} reducedMotion="user" />Test Connection</SecondaryButton>
        <SecondaryButton type="button" onClick={() => void test(true)}><MorphIcon icon={Send} size={14} strokeWidth={2} reducedMotion="user" />Send Test Email</SecondaryButton>
      </div>
    </form>
  );
}

function SettingsSection({ icon, title, description, children }: { icon: IconNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#014171] shadow-sm">
          <MorphIcon icon={icon} size={16} strokeWidth={2} reducedMotion="user" />
        </span>
        <div>
          <h3 className="text-sm font-bold text-slate-700">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
