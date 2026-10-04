import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { db } from "@/db";
import {
  departments,
  locations,
  printerAlerts,
  printerConsumableReadings,
  printerMonitoringReadings,
  printers,
  subunits,
  userPrinterPermissions,
  users,
} from "@/db/schema";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { requireModuleFullAccess, requireSession } from "@/lib/server-utils";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";
import { getEmployeePrinterRequestScope } from "@/lib/employee-printer-requests";
import EmployeePrinterCard from "./EmployeePrinterCard";
import RequestPrinterAccessDialog from "./RequestPrinterAccessDialog";

type BadgeColor = "green" | "yellow" | "red" | "blue" | "gray" | "orange";
type MonitoringSnapshot = {
  reading_id: number;
  printer_id: number;
  checked_at: Date | string;
  online: boolean;
  printer_status: string | null;
  error_status: string | null;
  error_message: string | null;
};
type ActivePrinterAlert = {
  printerId: number;
  type: string;
  severity: string;
  message: string;
};
type LatestConsumable = {
  printerId: number;
  name: string;
  type: string;
  levelPercent: number | null;
  status: string | null;
  isUnknown: boolean;
};

export async function AvailablePrintersPageContent({
  accountRole,
}: {
  accountRole: "employee" | "support";
}) {
  const session = accountRole === "support"
    ? await requireModuleFullAccess("printops")
    : await requireSession();
  if (session.role !== accountRole) {
    redirect(session.role === "employee" ? "/portal" : "/overview");
  }

  const [employee] = await db.select({
    primaryLocationId: users.primaryLocationId,
    departmentId: users.departmentId,
    subunitId: users.subunitId,
    costCenterId: users.costCenterId,
  }).from(users)
    .where(eq(users.id, session.id))
    .limit(1);

  if (!employee) redirect("/login");

  const requestScope = await getEmployeePrinterRequestScope(session.id, await headers());

  const availablePrinters = employee.primaryLocationId
    ? await db.select({
        id: printers.id,
        serialNumber: printers.serialNumber,
        model: printers.model,
        ipAddress: printers.ipAddress,
        macAddress: printers.macAddress,
        status: printers.status,
        floor: printers.floor,
        locationName: locations.name,
        departmentName: departments.name,
        subunitName: subunits.name,
      }).from(printers)
        .leftJoin(locations, eq(locations.id, printers.locationId))
        .leftJoin(departments, eq(departments.id, printers.departmentId))
        .leftJoin(subunits, eq(subunits.id, printers.subunitId))
        .leftJoin(
          userPrinterPermissions,
          and(
            eq(userPrinterPermissions.printerId, printers.id),
            eq(userPrinterPermissions.userId, session.id),
          ),
        )
        .where(and(
          eq(printers.status, "Active"),
          employee.departmentId
            ? or(
                and(
                  eq(printers.locationId, employee.primaryLocationId),
                  eq(printers.departmentId, employee.departmentId),
                  employee.subunitId ? eq(printers.subunitId, employee.subunitId) : undefined,
                  employee.costCenterId ? eq(printers.costCenterId, employee.costCenterId) : undefined,
                ),
                eq(userPrinterPermissions.userId, session.id),
              )
            : eq(userPrinterPermissions.userId, session.id),
        )).orderBy(asc(printers.model), asc(printers.serialNumber))
    : [];

  const printerIds = availablePrinters.map((printer) => printer.id);
  const monitoringSnapshots: MonitoringSnapshot[] = [];
  const activeAlerts: ActivePrinterAlert[] = [];
  const latestConsumables: LatestConsumable[] = [];
  const staleSeconds = await getMonitoringStaleSeconds();

  if (printerIds.length > 0) {
    const [monitoringResult, alertRows] = await Promise.all([
      db.execute<MonitoringSnapshot>(sql`
        select distinct on (${printerMonitoringReadings.printerId})
          ${printerMonitoringReadings.id} as reading_id,
          ${printerMonitoringReadings.printerId} as printer_id,
          ${printerMonitoringReadings.checkedAt} as checked_at,
          ${printerMonitoringReadings.online} as online,
          ${printerMonitoringReadings.printerStatus} as printer_status,
          ${printerMonitoringReadings.errorStatus} as error_status,
          ${printerMonitoringReadings.errorMessage} as error_message
        from ${printerMonitoringReadings}
        where ${printerMonitoringReadings.printerId} in (${sql.join(printerIds.map((printerId) => sql`${printerId}`), sql`, `)})
        order by
          ${printerMonitoringReadings.printerId},
          ${printerMonitoringReadings.checkedAt} desc,
          ${printerMonitoringReadings.id} desc
      `),
      db
        .select({
          printerId: printerAlerts.printerId,
          type: printerAlerts.type,
          severity: printerAlerts.severity,
          message: printerAlerts.message,
        })
        .from(printerAlerts)
        .where(
          and(
            inArray(printerAlerts.printerId, printerIds),
            isNull(printerAlerts.resolvedAt),
          ),
        )
        .orderBy(desc(printerAlerts.startedAt)),
    ]);
    monitoringSnapshots.push(...monitoringResult.rows);
    activeAlerts.push(...alertRows);

    const readingIds = monitoringSnapshots.map((snapshot) => snapshot.reading_id);
    if (readingIds.length > 0) {
      latestConsumables.push(...await db
        .select({
          printerId: printerConsumableReadings.printerId,
          name: printerConsumableReadings.name,
          type: printerConsumableReadings.type,
          levelPercent: printerConsumableReadings.levelPercent,
          status: printerConsumableReadings.status,
          isUnknown: printerConsumableReadings.isUnknown,
        })
        .from(printerConsumableReadings)
        .where(inArray(printerConsumableReadings.monitoringReadingId, readingIds))
        .orderBy(asc(printerConsumableReadings.name)));
    }
  }

  const monitoringByPrinter = new Map(
    monitoringSnapshots.map((snapshot) => [snapshot.printer_id, snapshot]),
  );
  const alertsByPrinter = new Map<number, ActivePrinterAlert[]>();
  for (const alert of activeAlerts) {
    const printerAlertRows = alertsByPrinter.get(alert.printerId) ?? [];
    printerAlertRows.push(alert);
    alertsByPrinter.set(alert.printerId, printerAlertRows);
  }
  const consumablesByPrinter = new Map<number, LatestConsumable[]>();
  for (const consumable of latestConsumables) {
    const printerConsumables = consumablesByPrinter.get(consumable.printerId) ?? [];
    printerConsumables.push(consumable);
    consumablesByPrinter.set(consumable.printerId, printerConsumables);
  }
  const renderedAt = new Date();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Available Printers"
        subtitle="View printers available for your account."
        actions={
          <RequestPrinterAccessDialog
            scope={requestScope}
            employee={{
              id: session.id,
              name: session.fullName,
              email: session.email,
              role: session.role,
            }}
          />
        }
      />

      {availablePrinters.length === 0 ? (
        <Card>
          <EmptyState message="No department or additional printers are available for your account yet." />
        </Card>
      ) : (
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          {availablePrinters.map((printer) => {
            const alerts = alertsByPrinter.get(printer.id) ?? [];
            const monitoring = monitoringPresentation(
              monitoringByPrinter.get(printer.id),
              alerts,
              renderedAt,
              staleSeconds,
            );

            return <EmployeePrinterCard
              key={printer.id}
              printer={printer}
              monitoring={monitoring}
              alerts={alerts}
              consumables={consumablesByPrinter.get(printer.id) ?? []}
            />;
          })}
        </div>
      )}
    </div>
  );
}

function monitoringPresentation(
  snapshot: MonitoringSnapshot | undefined,
  alerts: ActivePrinterAlert[],
  renderedAt: Date,
  staleSeconds: number,
): { label: string; color: BadgeColor } {
  if (!snapshot) return { label: "Not Monitored", color: "gray" };

  const checkedAt = new Date(snapshot.checked_at);
  const isStale = !Number.isNaN(checkedAt.getTime())
    && checkedAt.getTime() < renderedAt.getTime() - staleSeconds * 1_000;
  if (isStale) return { label: "Stale", color: "orange" };
  if (!snapshot.online) return { label: "Offline", color: "red" };

  const hasWarning = Boolean(snapshot.error_status?.trim())
    || Boolean(snapshot.error_message?.trim())
    || alerts.some((alert) => ["warning", "error", "critical"].includes(alert.severity.toLowerCase()));
  if (hasWarning) return { label: "Warning", color: "yellow" };

  const label = formatMonitoringStatus(snapshot.printer_status) || "Online";
  const normalized = label.toLowerCase();
  if (normalized.includes("print") || normalized.includes("process")) {
    return { label, color: "blue" };
  }
  if (["idle", "ready", "online", "normal", "standby", "sleeping"].some((status) => normalized.includes(status))) {
    return { label, color: "green" };
  }
  return { label, color: "gray" };
}

function formatMonitoringStatus(status: string | null) {
  return status
    ?.trim()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
