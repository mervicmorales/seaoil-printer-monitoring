import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { costCenters, departments, locations, printerAccessRequests, printers, subunits, userModuleAccess, userPrinterPermissions, users } from "@/db/schema";
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
  resetUserMfaAction,
  updatePermissionsAction,
  updatePrinterPermissionsAction,
} from "../actions";
import { canManageRole, canSetTemporaryPassword, hasAdminPrivileges, roleLabel } from "@/lib/roles";
import { getPrintOpsAgents } from "../../printops/data";
import { KeyRound, Printer, UserRound, type IconNode } from "lucide";
import TemporaryPasswordDialog from "../TemporaryPasswordDialog";

function DetailSection({
  icon,
  title,
  description,
  details,
  compact = false,
}: {
  icon: IconNode;
  title: string;
  description: string;
  details: Array<[string, string | null]>;
  compact?: boolean;
}) {
  return (
    <section>
      <div className={`flex items-center rounded-lg bg-slate-100 ${compact ? "gap-2.5 px-3.5 py-2.5" : "gap-3 px-4 py-3"}`}>
        <span className={`flex shrink-0 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm ${compact ? "size-7" : "size-8"}`}>
          <IconGlyph icon={icon} size={compact ? 15 : 17} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>}
        </div>
      </div>
      <dl className={compact ? "px-3 py-2" : "px-4 py-3 sm:px-5"}>
        {details.map(([label, value]) => (
          <div key={label} className={`grid min-w-0 grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] items-start gap-4 ${compact ? "py-2" : "py-2.5"}`}>
            <dt className="text-sm font-medium text-slate-500">{label}</dt>
            <dd className="break-words text-sm font-semibold text-slate-900">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export async function ViewUserPage({
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
      subunit: subunits.name,
      costCenter: costCenters.code,
    }).from(users)
      .leftJoin(locations, eq(users.primaryLocationId, locations.id))
      .leftJoin(departments, eq(users.departmentId, departments.id))
      .leftJoin(subunits, eq(users.subunitId, subunits.id))
      .leftJoin(costCenters, eq(users.costCenterId, costCenters.id))
      .where(eq(users.id, userId))
      .limit(1),
    db.select().from(userModuleAccess).where(eq(userModuleAccess.userId, userId)),
  ]);
  const record = records[0];
  if (!record) notFound();

  const access = resolveModuleAccess(accessRows);
  const user = record.user;
  const canManageUser = canManageRole(session.role, user.role);
  const canAssignTemporaryPassword = canSetTemporaryPassword(session.role, user.role)
    && user.accountStatus === "active";
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
                user.subunitId ? eq(printers.subunitId, user.subunitId) : undefined,
                user.costCenterId ? eq(printers.costCenterId, user.costCenterId) : undefined,
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
          parentTitle="User Management"
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
      <div className={embedded ? "" : "space-y-5"}>
        <Tabs
          variant="segmented"
          tabs={[
            {
              key: "account",
              label: "Account Details",
              icon: UserRound,
              content: (
                <Card className="overflow-hidden !border-0">
                  <div className={embedded ? "space-y-4 p-4" : "space-y-6 p-5 sm:p-6"}>
                    <DetailSection
                      compact={embedded}
                      icon={UserRound}
                      title="General information"
                      description="Identity, sign-in, status, and organizational assignment"
                      details={[
                        ["Full Name", user.fullName],
                        ["Employee ID", user.employeeId],
                        ["Email Address", user.email],
                        ["Username", user.username],
                        ["Role", roleLabel(user.role)],
                        ["Status", user.accountStatus],
                        ["Password", user.passwordChangeRequired
                          ? `Temporary · change requested${user.temporaryPasswordExpiresAt ? ` · expires ${user.temporaryPasswordExpiresAt.toLocaleString()}` : ""}`
                          : "Permanent"],
                        ["Authenticator", user.totpEnabledAt ? `Enabled ${user.totpEnabledAt.toLocaleDateString()}` : "Not enabled"],
                        ["Office", record.location],
                        ["Department", record.department],
                        ["Subunit", record.subunit],
                        ["Cost Center", record.costCenter],
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
                <Card className="overflow-hidden !border-0">
                  <PanelHeader
                    compact={embedded}
                    icon={KeyRound}
                    title="Page Permissions"
                    description="Control which management pages and actions this account can access"
                  />
                  <div className={embedded ? "p-4" : "p-5 sm:p-6"}>
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
                <Card className="overflow-hidden !border-0">
                  <PanelHeader
                    compact={embedded}
                    icon={Printer}
                    title="Printer Permissions"
                    description="Department printers are automatic; grant persistent access to requested printers from other departments"
                  />
                  <div className={embedded ? "p-4" : "p-5 sm:p-6"}>
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
            {canAssignTemporaryPassword && (
              <TemporaryPasswordDialog userId={user.id} userName={user.fullName} />
            )}
            <Link href={`/manage/${user.id}/edit`}><SecondaryButton>Edit Account</SecondaryButton></Link>
            {user.id !== session.id && user.totpEnabledAt && (
              <DeleteButton
                action={resetUserMfaAction}
                id={user.id}
                title="Reset authenticator?"
                confirmText={`Remove authenticator protection and recovery codes for "${user.username}"? Their existing sessions will be signed out.`}
                label="Reset Authenticator"
                confirmLabel="Reset Authenticator"
                requireReason
                reasonLabel="Reason for reset"
                reasonPlaceholder="Explain why authenticator access must be reset"
                className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100"
              />
            )}
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
              {canAssignTemporaryPassword && (
                <TemporaryPasswordDialog userId={user.id} userName={user.fullName} />
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
  compact = false,
}: {
  icon: IconNode;
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={`flex shrink-0 items-center rounded-lg bg-slate-100 ${compact ? "mx-4 mt-4 gap-2.5 px-3.5 py-2.5" : "mx-5 mt-5 gap-3 px-4 py-3"}`}>
      <span className={`flex shrink-0 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm ${compact ? "size-7" : "size-8"}`}>
        <IconGlyph icon={icon} size={compact ? 15 : 18} />
      </span>
      <div>
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
      </div>
    </div>
  );
}
