"use client";

import { useState } from "react";
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
  return <form action={action} className="max-w-2xl space-y-5"><p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Status: {settings.smtpEnabled ? "Database SMTP enabled" : "Using environment SMTP fallback"}. Password configured: {settings.passwordConfigured ? "Yes" : "No"}.</p><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="smtpEnabled" defaultChecked={settings.smtpEnabled} />Email enabled using saved settings</label><div className="grid gap-4 sm:grid-cols-2"><Input label="SMTP Host" name="smtpHost" defaultValue={settings.smtpHost || ""} /><Input label="SMTP Port" name="smtpPort" type="number" min="1" max="65535" defaultValue={settings.smtpPort || 1025} /><Select label="Security" name="smtpSecurity" defaultValue={settings.smtpSecurity}><option value="none">None</option><option value="starttls">STARTTLS</option><option value="tls">TLS/SSL</option></Select><Input label="Username" name="smtpUsername" defaultValue={settings.smtpUsername || ""} /><Input label="Password" name="smtpPassword" type="password" placeholder={settings.passwordConfigured ? "Leave blank to keep current password" : ""} /><Input label="From Email" name="smtpFrom" type="email" defaultValue={settings.smtpFrom || ""} /><Input label="From Name" name="smtpFromName" defaultValue={settings.smtpFromName || "SEAOIL Printer"} /><Input label="Test Recipient" name="smtpTestRecipient" type="email" defaultValue={settings.smtpTestRecipient || ""} /></div><div className="flex flex-wrap gap-2"><PrimaryButton type="submit">Save Settings</PrimaryButton><SecondaryButton type="button" onClick={() => void test(false)}>Test Connection</SecondaryButton><SecondaryButton type="button" onClick={() => void test(true)}>Send Test Email</SecondaryButton></div>{status && <p className="text-sm text-slate-600">{status}</p>}{settings.smtpLastTestedAt && <p className="text-xs text-slate-500">Last successful test: {new Date(settings.smtpLastTestedAt).toLocaleString()}</p>}</form>;
}
