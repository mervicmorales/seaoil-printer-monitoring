import "server-only";

import { and, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  monitoringAgentLocations,
  monitoringAgents,
  printOpsCommands,
  userPrinterPermissions,
  users,
} from "@/db/schema";
import {
  mergeRecentScanDevices,
  normalizePrintOpsSnapshot,
  type PrintOpsSnapshot,
} from "@/lib/printops";
import { purgeExpiredScanFiles } from "@/lib/scan-retention";

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
  location: string | null;
  model: string | null;
  serialNumber: string;
  ipAddress: string | null;
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
  location: string | null;
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
  automaticallyAllowedDepartmentId?: number,
  includeAllCoveredLocationPrinters = false,
): Promise<PrintOpsAgent[]> {
  const [agents, agentLocationRows, syncCommands, assignedPrinterResult] = await Promise.all([
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
        agentId: monitoringAgentLocations.agentId,
        locationId: monitoringAgentLocations.locationId,
      })
      .from(monitoringAgentLocations),
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
        locations.name as location,
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
      left join locations on locations.id = printers.location_id
      order by assignments.agent_id, departments.name, printers.asset_tag, printers.serial_number
    `),
  ]);

  const locationsByAgent = new Map<number, Set<number>>();
  for (const row of agentLocationRows) {
    const locationIds = locationsByAgent.get(row.agentId) ?? new Set<number>();
    locationIds.add(row.locationId);
    locationsByAgent.set(row.agentId, locationIds);
  }

  const latestByAgent = new Map<number, (typeof syncCommands)[number]>();
  const recentSnapshotsByAgent = new Map<number, PrintOpsSnapshot[]>();
  for (const command of syncCommands) {
    if (!latestByAgent.has(command.agentId)) latestByAgent.set(command.agentId, command);
    const recentSnapshots = recentSnapshotsByAgent.get(command.agentId) ?? [];
    recentSnapshots.push(normalizePrintOpsSnapshot(command.result));
    recentSnapshotsByAgent.set(command.agentId, recentSnapshots);
  }
  const monitoredPrintersByAgent = new Map<number, MonitoredPrinterRow[]>();
  for (const printer of assignedPrinterResult.rows) {
    const existing = monitoredPrintersByAgent.get(printer.agent_id) ?? [];
    existing.push(printer);
    monitoredPrintersByAgent.set(printer.agent_id, existing);
  }

  return agents.filter((agent) => {
    if (!locationScope) return true;
    return agent.locationId === locationScope.locationId ||
      locationsByAgent.get(agent.id)?.has(locationScope.locationId) === true;
  }).map((agent) => {
    const command = latestByAgent.get(agent.id);
    const snapshot = normalizePrintOpsSnapshot(command?.result);
    const recentScanDevices = mergeRecentScanDevices(
      recentSnapshotsByAgent.get(agent.id) ?? [snapshot],
    );
    const monitoredPrinters = (monitoredPrintersByAgent.get(agent.id) ?? []).filter((printer) => {
      if (includeAllCoveredLocationPrinters) return true;
      if (!locationScope) return true;

      const explicitlyAllowed = allowedPrinterIds?.has(printer.printer_id) === true;
      const atAssignedLocation = printer.location_id === locationScope.locationId;
      const inAutomaticDepartment = automaticallyAllowedDepartmentId === undefined ||
        printer.department_id === automaticallyAllowedDepartmentId;
      return explicitlyAllowed || (atAssignedLocation && inAutomaticDepartment);
    });
    const visiblePrinterIds = new Set(monitoredPrinters.map((printer) => printer.printer_id));
    const onlinePrinterIds = new Set(
      monitoredPrinters.filter((printer) => printer.online).map((printer) => printer.printer_id),
    );
    const onlineScanDevices = recentScanDevices.filter((device) => (
      device.printerId === null || onlinePrinterIds.has(device.printerId)
    ));
    return {
      ...agent,
      physicalPrinters: monitoredPrinters.map((printer) => ({
        id: printer.printer_id,
        name: printer.name,
        catalogStatus: printer.catalog_status,
        department: printer.department,
        location: printer.location,
        model: printer.model,
        serialNumber: printer.serial_number,
        ipAddress: printer.ip,
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
        scanDevices: locationScope
          ? onlineScanDevices.filter((device) => (
              device.printerId !== null && visiblePrinterIds.has(device.printerId)
            ))
          : onlineScanDevices,
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
  if (type === "scan") await purgeExpiredScanFiles();
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
      hasOutputFile: sql<boolean>`${printOpsCommands.outputFileData} is not null`,
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

export function getPrintOpsActivityPrinter(
  command: {
    agentId: number;
    payload: Record<string, unknown>;
  },
  agents: readonly PrintOpsAgent[],
) {
  const agent = agents.find((candidate) => candidate.id === command.agentId);
  const explicitPrinterId = numericPayload(command.payload, "printerId");
  const deviceId = textPayload(command.payload, "device");
  const devicePrinterId = deviceId
    ? agent?.snapshot.scanDevices.find((device) => device.id === deviceId)?.printerId ??
      esclPrinterId(deviceId)
    : null;
  const printerId = explicitPrinterId ?? devicePrinterId;
  const printer = printerId
    ? agent?.physicalPrinters.find((candidate) => candidate.id === printerId)
    : undefined;

  return {
    location: textPayload(command.payload, "printerLocation") || printer?.location || "—",
    department: textPayload(command.payload, "printerDepartment") || printer?.department || "—",
    model: textPayload(command.payload, "printerModel") || printer?.model || "—",
    serialNumber:
      textPayload(command.payload, "printerSerialNumber") || printer?.serialNumber || "—",
  };
}

function textPayload(payload: Record<string, unknown>, key: string) {
  return typeof payload[key] === "string" ? payload[key] : "";
}

function numericPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : null;
}

function esclPrinterId(deviceId: string) {
  const match = deviceId.match(/^escl:(\d+)$/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
