import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { departments, locations, printerAccessRequests, printers, userModuleAccess, userPrinterPermissions, users } from "@/db/schema";
import { Card, IconGlyph, PageHeader, SecondaryButton } from "@/components/ui";
import DeleteButton from "@/components/DeleteButton";
import SuccessBanner from "@/components/SuccessBanner";
import { resolveModuleAccess } from "@/lib/permissions";
import { requireModuleFullAccess } from "@/lib/server-utils";
import PermissionsPanel from "../PermissionsPanel";
import PrinterPermissionsPanel from "../PrinterPermissionsPanel";
import Tabs from "@/components/Tabs";
import {
  deleteUserAction,
  refreshPrinterPermissionAgentAction,
  sendEmployeePasswordResetAction,
  updatePermissionsAction,
  updatePrinterPermissionsAction,
} from "../actions";
import { canManageRole, hasAdminPrivileges, roleLabel } from "@/lib/roles";
import { getPrintOpsAgents } from "../../printops/data";
import { KeyRound, MapPin, Printer, UserRound, type IconNode } from "lucide";

function DetailSection({
  icon,
  title,
  description,
  details,
}: {
  icon: IconNode;
  title: string;
  description: string;
  details: Array<[string, string | null]>;
}) {
  return (
    <section>
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
          <IconGlyph icon={icon} size={17} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-[#014171]">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
        {details.map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
            <dd className="mt-1.5 break-words text-sm font-semibold text-slate-800">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default async function ViewUserPage({
  params,
  searchParams,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ success?: string; error?: string }>;
  embedded?: boolean;
}) {
  const session = await requireModuleFullAccess("manage_users");
  const { id } = await params;
  const messages = (await searchParams) ?? {};
  const userId = Number(id);
  if (!Number.isInteger(userId) || userId < 1) notFound();

  const [records, accessRows] = await Promise.all([
    db.select({
      user: users,
      location: locations.name,
      department: departments.name,
    }).from(users)
      .leftJoin(locations, eq(users.primaryLocationId, locations.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .where(eq(users.id, userId))
      .limit(1),
    db.select().from(userModuleAccess).where(eq(userModuleAccess.userId, userId)),
  ]);
  const record = records[0];
  if (!record) notFound();

  const access = resolveModuleAccess(accessRows);
  const user = record.user;
  const canManageUser = canManageRole(session.role, user.role);
  const canConfigurePrinterPermissions = (
    user.role === "employee" && (
      session.role === "support" || hasAdminPrivileges(session.role)
    )
  ) || (
    user.role === "support" &&
    hasAdminPrivileges(session.role) &&
    canManageUser
  );
  const canViewPagePermissions = (
    hasAdminPrivileges(session.role) && canManageUser
  ) || (
    session.role === "support" && user.role === "employee"
  );
  const [permissionAgents, printerPermissionRows, automaticPrinterRows, pendingPrinterRequestRows] = canConfigurePrinterPermissions
    ? await Promise.all([
        user.primaryLocationId
          ? getPrintOpsAgents({
              locationId: user.primaryLocationId,
            }, undefined, undefined, true)
          : [],
        db
          .select({ printerId: userPrinterPermissions.printerId })
          .from(userPrinterPermissions)
          .where(eq(userPrinterPermissions.userId, user.id)),
        (user.role === "support" || user.role === "employee") && user.primaryLocationId && user.departmentId
          ? db
              .select({ printerId: printers.id })
              .from(printers)
              .where(and(
                eq(printers.locationId, user.primaryLocationId),
                eq(printers.departmentId, user.departmentId),
                eq(printers.status, "Active"),
              ))
          : Promise.resolve([]),
        db
          .select({ printerId: printerAccessRequests.printerId })
          .from(printerAccessRequests)
          .where(and(
            eq(printerAccessRequests.userId, user.id),
            eq(printerAccessRequests.status, "pending"),
          )),
      ])
    : [[], [], [], []];

  return (
    <div>
      {!embedded && (
        <PageHeader
          title={user.fullName}
          subtitle="Account Details"
          actions={<Link href="/manage"><SecondaryButton>Back to User Management</SecondaryButton></Link>}
        />
      )}
      <SuccessBanner
        message={messages.success}
        errorMessage={messages.error}
        showInline={false}
      />
      <div className="space-y-5">
        <Tabs
          tabs={[
            {
              key: "account",
              label: "Account Details",
              icon: UserRound,
              content: (
                <Card className="overflow-hidden">
                  <div className="space-y-6 p-5 sm:p-6">
                    <DetailSection
                      icon={UserRound}
                      title="Account details"
                      description="Identity, sign-in, role, and account status"
                      details={[
                        ["Full Name", user.fullName],
                        ["Employee ID", user.employeeId],
                        ["Email Address", user.email],
                        ["Username", user.username],
                        ["Role", roleLabel(user.role)],
                        ["Status", user.accountStatus],
                      ]}
                    />
                    <DetailSection
                      icon={MapPin}
                      title="Assignment details"
                      description="Primary organizational location and department"
                      details={[
                        ["Location", record.location],
                        ["Department", record.department],
                      ]}
                    />
                  </div>
                </Card>
              ),
            },
            ...(canViewPagePermissions ? [{
              key: "page-permissions",
              label: "Page Permissions",
              icon: KeyRound,
              content: (
                <Card className="overflow-hidden">
                  <PanelHeader
                    icon={KeyRound}
                    title="Page Permissions"
                    description="Control which management pages and actions this account can access"
                  />
                  <div className="p-5 sm:p-6">
                    <PermissionsPanel
                      userId={user.id}
                      role={user.role}
                      access={access}
                      action={updatePermissionsAction}
                      actorRole={session.role}
                    />
                  </div>
                </Card>
              ),
            }] : []),
            ...(canConfigurePrinterPermissions ? [{
              key: "printer-permission",
              label: "Printer Permissions",
              icon: Printer,
              content: (
                <Card className="overflow-hidden">
                  <PanelHeader
                    icon={Printer}
                    title="Printer Permissions"
                    description="Department printers are automatic; grant persistent access to requested printers from other departments"
                  />
                  <div className="p-5 sm:p-6">
                    <PrinterPermissionsPanel
                      userId={user.id}
                      locationName={record.location}
                      agents={permissionAgents.map((agent) => ({
                        id: agent.id,
                        name: agent.name,
                        status: agent.status,
                        snapshotAt: agent.snapshotAt?.toISOString() ?? null,
                        printers: agent.physicalPrinters.filter(
                          (printer) => printer.catalogStatus === "Active",
                        ).map((printer) => ({
                          id: printer.id,
                          name: printer.name,
                          model: printer.model,
                          serialNumber: printer.serialNumber,
                          ipAddress: printer.ipAddress,
                          department: printer.department,
                          location: printer.location,
                          online: printer.online,
                          status: printer.status,
                        })),
                      }))}
                      permissionIds={printerPermissionRows.map((permission) => permission.printerId)}
                      automaticPrinterIds={automaticPrinterRows.map((printer) => printer.printerId)}
                      pendingRequestIds={pendingPrinterRequestRows.map((request) => request.printerId)}
                      refreshAction={refreshPrinterPermissionAgentAction}
                      saveAction={updatePrinterPermissionsAction}
                    />
                  </div>
                </Card>
              ),
            }] : []),
          ]}
          defaultKey="account"
        />

        {!embedded && (
          <div className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            {hasAdminPrivileges(session.role) && canManageUser && <>
            {user.role === "employee" && user.accountStatus === "active" && (
              <form action={sendEmployeePasswordResetAction}>
                <input type="hidden" name="id" value={user.id} />
                <button type="submit" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-[#014171] transition hover:bg-sky-100">Reset Password</button>
              </form>
            )}
            <Link href={`/manage/${user.id}/edit`}><SecondaryButton>Edit Account</SecondaryButton></Link>
            {user.id !== session.id && (
              <DeleteButton
                action={deleteUserAction}
                id={user.id}
                title="Delete user account?"
                confirmText={`Delete user "${user.username}"? This action cannot be undone.`}
                requireReason
                reasonPlaceholder="Explain why this user account is being deleted"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              />
            )}
            </>}
            {session.role === "support" && <>
              {user.role === "employee" && user.accountStatus === "active" && (
                <form action={sendEmployeePasswordResetAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <button type="submit" className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-[#014171] transition hover:bg-sky-100">Reset Password</button>
                </form>
              )}
              <button type="button" disabled className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Edit Account</button>
              <button type="button" disabled className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Delete Account</button>
            </>}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelHeader({
  icon,
  title,
  description,
}: {
  icon: IconNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:px-6">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
        <IconGlyph icon={icon} size={18} />
      </span>
      <div>
        <h2 className="font-bold text-[#014171]">{title}</h2>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
    </div>
  );
}
