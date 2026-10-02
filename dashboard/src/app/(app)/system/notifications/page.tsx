import { BellRing, Mail } from "lucide";
import { Card, PageHeader } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import Tabs from "@/components/Tabs";
import { getSystemSettings, requireModuleFullAccess } from "@/lib/server-utils";
import { hasAdminPrivileges } from "@/lib/roles";
import ReminderSettingsForm from "../ReminderSettingsForm";
import SmtpSettingsForm from "../SmtpSettingsForm";
import { updateSettingsAction, updateSmtpSettingsAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; success?: string; error?: string }>;
}) {
  const session = await requireModuleFullAccess("system");
  const [settings, sp] = await Promise.all([getSystemSettings(), searchParams]);
  const isAdmin = hasAdminPrivileges(session.role);
  const publicSmtpSettings = {
    smtpEnabled: settings.smtpEnabled,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecurity: settings.smtpSecurity,
    smtpUsername: settings.smtpUsername,
    smtpFrom: settings.smtpFrom,
    smtpFromName: settings.smtpFromName,
    smtpTestRecipient: settings.smtpTestRecipient,
    smtpLastTestedAt: settings.smtpLastTestedAt,
    passwordConfigured: Boolean(settings.smtpPasswordEncrypted),
  };

  const denied = (
    <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
      Administrator access is required to change these settings.
    </p>
  );

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader title="Email and Notifications" parentTitle="System" />
      <SuccessBanner message={sp.success} errorMessage={sp.error} showInline={false} />
      <Tabs
        fillHeight
        defaultKey={sp.tab}
        tabs={[
          {
            key: "email",
            label: "Email / SMTP",
            icon: Mail,
            content: (
              <Card className="h-full overflow-y-auto p-5 sm:p-6">
                <div className="mx-auto max-w-4xl">
                  {isAdmin ? <SmtpSettingsForm action={updateSmtpSettingsAction} settings={publicSmtpSettings} /> : denied}
                </div>
              </Card>
            ),
          },
          {
            key: "reminders",
            label: "Toner Reminder and Email",
            icon: BellRing,
            content: (
              <Card className="h-full overflow-y-auto p-5 sm:p-6">
                <div className="mx-auto max-w-4xl">
                  <ReminderSettingsForm action={updateSettingsAction} settings={settings} readOnly={!isAdmin} />
                </div>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
