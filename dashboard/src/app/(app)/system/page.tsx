import { db } from "@/db";
import { locations, departments, itsNames, tonerTypes, tonerInventory, vendors } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  BellRing,
  Building2,
  Droplets,
  Mail,
  MapPin,
  Truck,
  UserRound,
} from "lucide";
import { PageHeader, Card } from "@/components/ui";
import SuccessBanner from "@/components/SuccessBanner";
import Tabs from "@/components/Tabs";
import LookupTable from "@/components/LookupTable";
import VendorManager from "./VendorManager";
import TonerTypeManager from "./TonerTypeManager";
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
      <PageHeader title="System Settings" subtitle="Manage reference data, notifications, integrations, and monitoring preferences." />
      <SuccessBanner message={sp.success} />
      {sp.error && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{sp.error}</p>}

      <Tabs
        fillHeight
        defaultKey={sp.tab}
        tabs={[
          {
            key: "email",
            label: "Email / SMTP",
            icon: Mail,
            content: <Card className="h-full overflow-auto p-5 sm:p-6">{session.role === "admin" ? <SmtpSettingsForm action={updateSmtpSettingsAction} settings={publicSmtpSettings} /> : <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">Administrator access is required.</p>}</Card>,
          },
          {
            key: "locations",
            label: "Locations",
            icon: MapPin,
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-5 sm:p-6">
                <LookupTable
                  items={allLocations}
                  addAction={addLocationAction}
                  updateAction={updateLocationAction}
                  deleteAction={deleteLocationAction}
                  placeholder="e.g. Head Office"
                  readOnly={session.role !== "admin"}
                  fillHeight
                  title="Office locations"
                  description="Locations used for printer, user, and monitoring assignments."
                />
              </Card>
            ),
          },
          {
            key: "departments",
            label: "Departments",
            icon: Building2,
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-5 sm:p-6">
                <LookupTable
                  items={allDepartments}
                  addAction={addDepartmentAction}
                  updateAction={updateDepartmentAction}
                  deleteAction={deleteDepartmentAction}
                  placeholder="e.g. IT Services"
                  readOnly={session.role !== "admin"}
                  fillHeight
                  title="Departments"
                  description="Departments used to organize users and printer assignments."
                />
              </Card>
            ),
          },
          {
            key: "toner",
            label: "Toner Types",
            icon: Droplets,
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-5 sm:p-6">
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
                  isAdmin={session.role === "admin"}
                />
              </Card>
            ),
          },
          {
            key: "vendors",
            label: "Vendor / Supplier",
            icon: Truck,
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-5 sm:p-6">
                <VendorManager vendors={allVendors} addAction={addVendorAction} updateAction={updateVendorAction} deleteAction={deleteVendorAction} readOnly={session.role !== "admin"} />
              </Card>
            ),
          },
          {
            key: "its",
            label: "ITS Names",
            icon: UserRound,
            content: (
              <Card className="h-full min-h-0 overflow-hidden p-5 sm:p-6">
                <LookupTable items={allItsNames} addAction={addItsNameAction} deleteAction={deleteItsNameAction} editable={false} readOnly={session.role !== "admin"} placeholder="e.g. Patrick" fillHeight title="ITS names" description="Support names available in printer and service records." />
              </Card>
            ),
          },
          {
            key: "reminders",
            label: "Toner Reminder & Email",
            icon: BellRing,
            content: (
              <Card className="h-full overflow-auto p-5 sm:p-6">
                <ReminderSettingsForm action={updateSettingsAction} settings={settings} readOnly={session.role !== "admin"} />
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
