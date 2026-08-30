import { db } from "@/db";
import { locations, departments, itsNames, tonerTypes, tonerInventory, vendors } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { PageHeader, Card } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import Tabs from "@/components/Tabs";
import LookupTable from "@/components/LookupTable";
import VendorManager from "./VendorManager";
import TonerTypeManager from "./TonerTypeManager";
import GeneralSettings from "./GeneralSettings";
import ReminderSettingsForm from "./ReminderSettingsForm";
import SmtpSettingsForm from "./SmtpSettingsForm";
import { getSystemSettings, requireModuleFullAccess } from "@/lib/server-utils";
import {
  addLocationAction,
  updateLocationAction,
  deleteLocationAction,
  addDepartmentAction,
  updateDepartmentAction,
  deleteDepartmentAction,
  addItsNameAction,
  deleteItsNameAction,
  addTonerTypeAction,
  updateTonerTypeAction,
  deleteTonerTypeAction,
  updateThresholdAction,
  updateAlertCardVisibilityAction,
  addVendorAction,
  updateVendorAction,
  deleteVendorAction,
  updateSettingsAction,
  updateSmtpSettingsAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function SystemPage({ searchParams }: { searchParams: Promise<{ tab?: string; success?: string; error?: string }> }) {
  const session = await requireModuleFullAccess("system");
  const sp = await searchParams;

  const [allLocations, allDepartments, allItsNames, tonerRows, allVendors, settings] = await Promise.all([
    db.select().from(locations).orderBy(asc(locations.name)),
    db.select().from(departments).orderBy(asc(departments.name)),
    db.select().from(itsNames).orderBy(asc(itsNames.name)),
    db
      .select({
        id: tonerTypes.id,
        name: tonerTypes.name,
        stock: tonerInventory.stock,
        threshold: tonerInventory.lowStockThreshold,
        criticalThreshold: tonerInventory.criticalStockThreshold,
        showAlertCard: tonerTypes.showAlertCard,
      })
      .from(tonerTypes)
      .leftJoin(tonerInventory, eq(tonerInventory.tonerTypeId, tonerTypes.id))
      .orderBy(asc(tonerTypes.name)),
    db.select().from(vendors).orderBy(asc(vendors.name)),
    getSystemSettings(),
  ]);
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

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[36rem] flex-col">
      <PageHeader title="System" subtitle="Manage lookup databases and monitoring preferences." />
      <SuccessBanner message={sp.success} />
      {sp.error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{sp.error}</p>}

      <Tabs
        fillHeight
        defaultKey={sp.tab}
        tabs={[
          {
            key: "email",
            label: "Email / SMTP",
            content: <Card className="h-full overflow-auto p-6">{session.role === "admin" ? <SmtpSettingsForm action={updateSmtpSettingsAction} settings={publicSmtpSettings} /> : <p className="text-sm text-red-700">Administrator access is required.</p>}</Card>,
          },
          {
            key: "locations",
            label: "Locations",
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-6">
                <LookupTable
                  items={allLocations}
                  addAction={addLocationAction}
                  updateAction={updateLocationAction}
                  deleteAction={deleteLocationAction}
                  placeholder="e.g. Head Office"
                  fillHeight
                />
              </Card>
            ),
          },
          {
            key: "departments",
            label: "Departments",
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-6">
                <LookupTable
                  items={allDepartments}
                  addAction={addDepartmentAction}
                  updateAction={updateDepartmentAction}
                  deleteAction={deleteDepartmentAction}
                  placeholder="e.g. IT Services"
                  fillHeight
                />
              </Card>
            ),
          },
          {
            key: "toner",
            label: "Toner Types",
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-6">
                <TonerTypeManager
                  items={tonerRows.map((t) => ({
                    id: t.id,
                    name: t.name,
                    stock: t.stock ?? 0,
                    threshold: t.threshold ?? 5,
                    criticalThreshold: t.criticalThreshold ?? 2,
                    showAlertCard: t.showAlertCard,
                  }))}
                  addAction={addTonerTypeAction}
                  updateAction={updateTonerTypeAction}
                  deleteAction={deleteTonerTypeAction}
                  thresholdAction={updateThresholdAction}
                  visibilityAction={updateAlertCardVisibilityAction}
                />
              </Card>
            ),
          },
          {
            key: "vendors",
            label: "Vendor / Supplier",
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-6">
                <VendorManager vendors={allVendors} addAction={addVendorAction} updateAction={updateVendorAction} deleteAction={deleteVendorAction} />
              </Card>
            ),
          },
          {
            key: "its",
            label: "ITS Names",
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-6">
                <LookupTable items={allItsNames} addAction={addItsNameAction} deleteAction={deleteItsNameAction} editable={false} placeholder="e.g. Patrick" fillHeight />
              </Card>
            ),
          },
          {
            key: "reminders",
            label: "Toner Reminder & Email",
            content: (
              <Card className="h-full overflow-auto p-6">
                <ReminderSettingsForm action={updateSettingsAction} settings={settings} />
              </Card>
            ),
          },
          {
            key: "general",
            label: "About",
            content: <GeneralSettings />,
          },
        ]}
      />
    </div>
  );
}
