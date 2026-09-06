import "server-only";

import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  monitoringAgents,
  printOpsCommands,
  userPrinterPermissions,
  users,
} from "@/db/schema";
import { normalizePrintOpsSnapshot, type PrintOpsSnapshot } from "@/lib/printops";

export type PrintOpsAgent = {
  id: number;
  name: string;
  hostname: string | null;
  status: string;
  lastSeen: Date | null;
  snapshot: PrintOpsSnapshot;
  snapshotAt: Date | null;
  physicalPrinters: PrintOpsPhysicalPrinter[];
};

export type PrintOpsLocationScope = {
  locationId: number;
  departmentId?: number;
};

export async function getPrintOpsLocationScope(
  userId: number,
): Promise<PrintOpsLocationScope | null> {
  const [employee] = await db
    .select({
      locationId: users.primaryLocationId,
      departmentId: users.departmentId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!employee?.locationId || !employee.departmentId) return null;
  return {
    locationId: employee.locationId,
    departmentId: employee.departmentId,
  };
}

export async function getUserPrinterPermissionIds(userId: number) {
  const rows = await db
    .select({ printerId: userPrinterPermissions.printerId })
    .from(userPrinterPermissions)
    .where(eq(userPrinterPermissions.userId, userId));
  return new Set(rows.map((row) => row.printerId));
}

export type PrintOpsPhysicalPrinter = {
  id: number;
  name: string;
  catalogStatus: string;
  department: string | null;
  model: string | null;
  serialNumber: string;
  online: boolean;
  status: string;
  checkedAt: Date;
};

type MonitoredPrinterRow = {
  agent_id: number;
  printer_id: number;
  name: string;
  ip: string | null;
  location_id: number | null;
  department_id: number | null;
  department: string | null;
  model: string | null;
  serial_number: string;
  online: boolean;
  printer_status: string | null;
  catalog_status: string;
  checked_at: Date;
};

export async function getPrintOpsAgents(
  locationScope?: PrintOpsLocationScope,
  allowedPrinterIds?: ReadonlySet<number>,
): Promise<PrintOpsAgent[]> {
  const [agents, syncCommands, assignedPrinterResult] = await Promise.all([
    db
      .select({
        id: monitoringAgents.id,
        name: monitoringAgents.name,
        locationId: monitoringAgents.locationId,
        hostname: monitoringAgents.hostname,
        status: monitoringAgents.status,
        lastSeen: monitoringAgents.lastSeen,
      })
      .from(monitoringAgents)
      .where(
        and(
          isNotNull(monitoringAgents.tokenHash),
          isNull(monitoringAgents.tokenRevokedAt),
        ),
      )
      .orderBy(monitoringAgents.name),
    db
      .select({
        agentId: printOpsCommands.agentId,
        result: printOpsCommands.result,
        completedAt: printOpsCommands.completedAt,
      })
      .from(printOpsCommands)
      .where(
        and(
          eq(printOpsCommands.type, "sync"),
          eq(printOpsCommands.status, "completed"),
        ),
      )
      .orderBy(desc(printOpsCommands.completedAt), desc(printOpsCommands.id))
      .limit(200),
    db.execute<MonitoredPrinterRow>(sql`
      with latest_readings as (
        select distinct on (printer_id, agent_id)
          printer_id, agent_id, online, printer_status, checked_at
        from printer_monitoring_readings
        order by printer_id, agent_id, checked_at desc, id desc
      )
      select
        assignments.agent_id,
        printers.id as printer_id,
        coalesce(printers.asset_tag, printers.serial_number) as name,
        printers.ip_address as ip,
        printers.location_id,
        printers.department_id,
        departments.name as department,
        printers.model,
        printers.serial_number,
        latest_readings.online,
        latest_readings.printer_status,
        printers.status as catalog_status,
        latest_readings.checked_at
      from printer_monitoring_assignments assignments
      inner join printers on printers.id = assignments.printer_id
      inner join latest_readings
        on latest_readings.printer_id = printers.id
        and latest_readings.agent_id = assignments.agent_id
      left join departments on departments.id = printers.department_id
      order by assignments.agent_id, departments.name, printers.asset_tag, printers.serial_number
    `),
  ]);

  const latestByAgent = new Map<number, (typeof syncCommands)[number]>();
  for (const command of syncCommands) {
    if (!latestByAgent.has(command.agentId)) latestByAgent.set(command.agentId, command);
  }
  const monitoredPrintersByAgent = new Map<number, MonitoredPrinterRow[]>();
  for (const printer of assignedPrinterResult.rows) {
    const existing = monitoredPrintersByAgent.get(printer.agent_id) ?? [];
    existing.push(printer);
    monitoredPrintersByAgent.set(printer.agent_id, existing);
  }

  return agents.filter((agent) => (
    !locationScope || agent.locationId === locationScope.locationId
  )).map((agent) => {
    const command = latestByAgent.get(agent.id);
    const snapshot = normalizePrintOpsSnapshot(command?.result);
    const monitoredPrinters = (monitoredPrintersByAgent.get(agent.id) ?? []).filter(
      (printer) => !locationScope || (
        printer.location_id === locationScope.locationId &&
        (locationScope.departmentId === undefined ||
          printer.department_id === locationScope.departmentId)
      ),
    ).filter((printer) => !allowedPrinterIds || allowedPrinterIds.has(printer.printer_id));
    return {
      ...agent,
      physicalPrinters: monitoredPrinters.map((printer) => ({
        id: printer.printer_id,
        name: printer.name,
        catalogStatus: printer.catalog_status,
        department: printer.department,
        model: printer.model,
        serialNumber: printer.serial_number,
        online: printer.online,
        status: printer.printer_status ?? (printer.online ? "Unknown" : "Offline"),
        checkedAt: printer.checked_at,
      })),
      snapshot: {
        ...snapshot,
        printerTargets: monitoredPrinters.filter((printer) => printer.online).map((printer) => ({
          printerId: printer.printer_id,
          name: printer.name,
          ip: printer.ip ?? "",
          queue:
            snapshot.printerTargets.find((target) => target.printerId === printer.printer_id)
              ?.queue ?? "",
          department: printer.department,
          model: printer.model,
          serialNumber: printer.serial_number,
        })),
      },
      snapshotAt: command?.completedAt ?? null,
    };
  });
}

export async function getRecentPrintOpsCommands(
  type: string,
  limit = 20,
  requestedBy?: number,
) {
  return db
    .select({
      id: printOpsCommands.id,
      agentId: printOpsCommands.agentId,
      agentName: monitoringAgents.name,
      requestedBy: printOpsCommands.requestedBy,
      type: printOpsCommands.type,
      status: printOpsCommands.status,
      payload: printOpsCommands.payload,
      result: printOpsCommands.result,
      inputFileName: printOpsCommands.inputFileName,
      outputFileName: printOpsCommands.outputFileName,
      outputMimeType: printOpsCommands.outputMimeType,
      errorMessage: printOpsCommands.errorMessage,
      requestedAt: printOpsCommands.requestedAt,
      completedAt: printOpsCommands.completedAt,
    })
    .from(printOpsCommands)
    .innerJoin(monitoringAgents, eq(printOpsCommands.agentId, monitoringAgents.id))
    .where(
      requestedBy === undefined
        ? eq(printOpsCommands.type, type)
        : and(
            eq(printOpsCommands.type, type),
            eq(printOpsCommands.requestedBy, requestedBy),
          ),
    )
    .orderBy(desc(printOpsCommands.requestedAt), desc(printOpsCommands.id))
    .limit(limit);
}
