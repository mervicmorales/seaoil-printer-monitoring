"use client";

import { BellRing, Mail, Save, SlidersHorizontal } from "lucide";
import { MorphIcon } from "morphicons/react";
import { Input, PrimaryButton } from "@/components/ui";

export default function ReminderSettingsForm({
  action,
  settings,
  readOnly = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  settings: {
    notificationEmail: string;
    defaultLowStockThreshold: number;
    emailReminderEnabled: boolean;
    systemNotificationEnabled: boolean;
    agentOfflineThresholdMinutes: number;
    tonerLowEmailEnabled: boolean;
    tonerCriticalEmailEnabled: boolean;
    tonerEmptyEmailEnabled: boolean;
    agentOfflineEmailEnabled: boolean;
    agentRecoveredEmailEnabled: boolean;
  };
  readOnly?: boolean;
}) {
  return (
    <form action={action} className="max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
          <MorphIcon icon={BellRing} size={18} strokeWidth={2} reducedMotion="user" />
        </span>
        <div>
          <h2 className="text-sm font-bold text-[#014171]">Notification preferences</h2>
          <p className="mt-0.5 text-xs text-slate-500">Control toner and monitoring-agent alerts delivered by email or in the system.</p>
        </div>
      </div>
      <fieldset disabled={readOnly} className="space-y-5 disabled:opacity-70">
        <section className="rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[#014171]"><MorphIcon icon={SlidersHorizontal} size={16} strokeWidth={2} reducedMotion="user" /></span>
            <h3 className="text-sm font-bold text-slate-700">Delivery defaults</h3>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Toner notification email"
              name="notificationEmail"
              type="text"
              placeholder="email@example.com, another@example.com"
              defaultValue={settings.notificationEmail}
              required
            />
            <Input
              label="Default numeric toner threshold"
              name="defaultLowStockThreshold"
              type="number"
              min="0"
              defaultValue={settings.defaultLowStockThreshold}
              required
            />
            <Input
              label="Agent offline grace period (minutes)"
              name="agentOfflineThresholdMinutes"
              type="number"
              min="1"
              max="1440"
              defaultValue={settings.agentOfflineThresholdMinutes}
              required
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-[#014171]"><MorphIcon icon={Mail} size={16} strokeWidth={2} reducedMotion="user" /></span>
            <div>
              <h3 className="text-sm font-bold text-slate-700">Email notifications</h3>
              <p className="mt-0.5 text-xs text-slate-500">Choose which operational events send an email.</p>
            </div>
          </div>
          <ToggleRow
            name="emailReminderEnabled"
            label="Enable operational email notifications"
            description="Master control for all event-specific email messages below."
            defaultChecked={settings.emailReminderEnabled}
            prominent
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[["tonerLowEmailEnabled", "Toner Inventory Low"], ["tonerCriticalEmailEnabled", "Toner Inventory Critical"], ["tonerEmptyEmailEnabled", "Toner Inventory Empty"], ["agentOfflineEmailEnabled", "Monitoring Agent Offline"], ["agentRecoveredEmailEnabled", "Monitoring Agent Recovered"]].map(([name, label]) => (
              <ToggleRow
                key={name}
                name={name}
                label={label}
                defaultChecked={Boolean(settings[name as keyof typeof settings])}
              />
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-slate-50/35 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[#014171]"><MorphIcon icon={BellRing} size={16} strokeWidth={2} reducedMotion="user" /></span>
            <h3 className="text-sm font-bold text-slate-700">In-system notifications</h3>
          </div>
          <ToggleRow
            name="systemNotificationEnabled"
            label="Send system (bell) notifications"
            description="Show supported operational events in the application notification center."
            defaultChecked={settings.systemNotificationEnabled}
            prominent
          />
        </section>

        {!readOnly && (
          <div className="border-t border-slate-200 pt-5">
            <PrimaryButton type="submit">
              <MorphIcon icon={Save} size={15} strokeWidth={2} reducedMotion="user" />
              Save Settings
            </PrimaryButton>
          </div>
        )}
      </fieldset>
    </form>
  );
}

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
  prominent = false,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
  prominent?: boolean;
}) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm ${prominent ? "border-sky-200 bg-sky-50/70" : "border-slate-200 bg-white"}`}>
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 size-4 rounded border-slate-300 text-[#014171] focus:ring-[#014171]/20" />
      <span>
        <span className="block font-semibold text-slate-700">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
      </span>
    </label>
  );
}
