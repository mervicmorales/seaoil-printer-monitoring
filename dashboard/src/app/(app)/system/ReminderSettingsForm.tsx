"use client";

import { Input, PrimaryButton } from "@/components/ui";

export default function ReminderSettingsForm({
  action,
  settings,
}: {
  action: (formData: FormData) => void | Promise<void>;
  settings: {
    notificationEmail: string;
    defaultLowStockThreshold: number;
    emailReminderEnabled: boolean;
    systemNotificationEnabled: boolean;
  };
}) {
  return (
    <form action={action} className="max-w-xl space-y-5">
      <Input
        label="SEAOIL Printer Monitoring Email"
        name="notificationEmail"
        type="email"
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
        Send email low-stock reminders
      </label>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="systemNotificationEnabled" defaultChecked={settings.systemNotificationEnabled} />
        Send system (bell) notifications
      </label>
      <PrimaryButton type="submit">Save Settings</PrimaryButton>
    </form>
  );
}
