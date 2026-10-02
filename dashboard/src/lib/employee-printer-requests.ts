import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getMonitoringStaleSeconds } from "@/lib/monitoring-settings";

type CandidatePrinterRow = {
  printer_id: number;
  agent_id: number;
  agent_name: string;
  serial_number: string;
  model: string | null;
  ip_address: string | null;
  location_name: string | null;
  department_name: string | null;
  already_accessible: boolean;
  request_status: string | null;
};

export type EmployeePrinterRequestOption = {
  id: number;
  agentId: number;
  agentName: string;
  serialNumber: string;
  model: string | null;
  ipAddress: string | null;
  locationName: string | null;
  departmentName: string | null;
  alreadyAccessible: boolean;
  requestStatus: string | null;
};

export type EmployeePrinterRequestScope = {
  mode: "office-network" | "assigned-location";
  agentNames: string[];
  printers: EmployeePrinterRequestOption[];
};

export async function getEmployeePrinterRequestScope(
  userId: number,
  requestHeaders: Headers,
): Promise<EmployeePrinterRequestScope> {
  const staleSeconds = await getMonitoringStaleSeconds();
  const cutoff = new Date(Date.now() - staleSeconds * 1_000);
  const result = await db.execute<CandidatePrinterRow>(sql`
    select
      printer.id as printer_id,
      agent.id as agent_id,
      agent.name as agent_name,
      printer.serial_number,
      printer.model,
      printer.ip_address,
      office.name as location_name,
      department.name as department_name,
      (
        (
          printer.office_id = employee.primary_office_id
          and printer.department_id = employee.department_id
          and (employee.subunit_id is null or printer.subunit_id = employee.subunit_id)
          and (employee.cost_center_id is null or printer.cost_center_id = employee.cost_center_id)
        )
        or exists (
          select 1
          from user_printer_permissions permission
          where permission.user_id = employee.id
            and permission.printer_id = printer.id
        )
      ) as already_accessible,
      request.status as request_status
    from users employee
    inner join monitoring_agents agent
      on agent.token_hash is not null
      and agent.token_revoked_at is null
      and agent.status = 'online'
      and agent.last_seen >= ${cutoff}
      and (
        agent.office_id = employee.primary_office_id
        or exists (
          select 1
          from monitoring_agent_offices agent_office
          where agent_office.agent_id = agent.id
            and agent_office.office_id = employee.primary_office_id
        )
      )
    inner join printer_monitoring_assignments assignment
      on assignment.agent_id = agent.id
    inner join printers printer
      on printer.id = assignment.printer_id
      and printer.status = 'Active'
    left join offices office on office.id = printer.office_id
    left join departments department on department.id = printer.department_id
    left join printer_access_requests request
      on request.user_id = employee.id
      and request.printer_id = printer.id
    where employee.id = ${userId}
      and employee.role in ('employee', 'support')
    order by office.name, department.name, printer.model, printer.serial_number
  `);

  const clientIp = getClientIpv4(requestHeaders);
  const networkRows = clientIp
    ? result.rows.filter((row) => sameIpv4Subnet24(clientIp, row.ip_address))
    : [];
  const selectedRows = networkRows.length > 0 ? networkRows : result.rows;

  return {
    mode: networkRows.length > 0 ? "office-network" : "assigned-location",
    agentNames: Array.from(new Set(selectedRows.map((row) => row.agent_name))),
    printers: selectedRows.map((row) => ({
      id: row.printer_id,
      agentId: row.agent_id,
      agentName: row.agent_name,
      serialNumber: row.serial_number,
      model: row.model,
      ipAddress: row.ip_address,
      locationName: row.location_name,
      departmentName: row.department_name,
      alreadyAccessible: row.already_accessible,
      requestStatus: row.request_status,
    })),
  };
}

function getClientIpv4(requestHeaders: Headers) {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwarded || requestHeaders.get("x-real-ip")?.trim() || "";
  const mappedIpv4 = candidate.startsWith("::ffff:") ? candidate.slice(7) : candidate;
  const withoutPort = mappedIpv4.match(/^([0-9.]+):\d+$/)?.[1] ?? mappedIpv4;
  return isIpv4(withoutPort) && !withoutPort.startsWith("127.") ? withoutPort : null;
}

function sameIpv4Subnet24(clientIp: string, printerIp: string | null) {
  if (!printerIp || !isIpv4(printerIp)) return false;
  return clientIp.split(".").slice(0, 3).join(".") ===
    printerIp.split(".").slice(0, 3).join(".");
}

function isIpv4(value: string) {
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => {
    if (!/^\d{1,3}$/.test(part)) return false;
    const number = Number(part);
    return number >= 0 && number <= 255 && String(number) === part;
  });
}
