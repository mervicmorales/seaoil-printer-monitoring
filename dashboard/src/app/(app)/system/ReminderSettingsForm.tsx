"use client";

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
    <form action={action} className="max-w-xl space-y-5">
      <fieldset disabled={readOnly} className="space-y-5 disabled:opacity-70">
      <Input
        label="Toner Notofications Email"
        name="notificationEmail"
        type="text"
        placeholder="email@example.com, another@example.com"
        defaultValue={settings.notificationEmail}
        required
      />
      <Input
        label="Default Numeric Toner Threshold"
        name="defaultLowStockThreshold"
        type="number"
        min="0"
        defaultValue={settings.defaultLowStockThreshold}
        required
      />
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="emailReminderEnabled" defaultChecked={settings.emailReminderEnabled} />
        Enable operational email notifications
      </label>
      <Input label="Agent offline grace period (minutes)" name="agentOfflineThresholdMinutes" type="number" min="1" max="1440" defaultValue={settings.agentOfflineThresholdMinutes} required />
      {[["tonerLowEmailEnabled", "Toner Inventory Low"], ["tonerCriticalEmailEnabled", "Toner Inventory Critical"], ["tonerEmptyEmailEnabled", "Toner Inventory Empty"], ["agentOfflineEmailEnabled", "Monitoring Agent Offline"], ["agentRecoveredEmailEnabled", "Monitoring Agent Recovered"]].map(([name, label]) => <label key={name} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" name={name} defaultChecked={Boolean(settings[name as keyof typeof settings])} />{label}</label>)}
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="systemNotificationEnabled" defaultChecked={settings.systemNotificationEnabled} />
        Send system (bell) notifications
      </label>
      {!readOnly && <PrimaryButton type="submit">Save Settings</PrimaryButton>}
      </fieldset>
    </form>
  );
}
