import "server-only";

import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  departments,
  itsNames,
  locations,
  monitoringAgents,
  printerAlerts,
  printers,
  repairTickets,
  subunits,
  tonerTransactions,
  tonerTypes,
  userRegistrationRequests,
} from "@/db/schema";
import type { ModuleName } from "@/lib/permissions";
import { normalizeTonerTransactionStatus } from "@/lib/toner-transaction-status";

export type RecentActivityCategory = "toner" | "repair" | "alert" | "account" | "printer" | "agent";

export type RecentActivityItem = {
  id: string;
  category: RecentActivityCategory;
  title: string;
  detail: string;
  meta?: string;
  occurredAt: Date;
  href: string;
};

type ModuleAccess = Record<ModuleName, boolean>;

const SOURCE_LIMIT = 12;

export async function getRecentActivities(access: ModuleAccess, canManageAgents: boolean, limit = 10): Promise<RecentActivityItem[]> {
  const [tonerRows, repairRows, alertRows, registrationRows, printerRows, agentRows] = await Promise.all([
    access.toner_monitoring
      ? db.select({
        id: tonerTransactions.id,
        type: tonerTransactions.type,
        quantity: tonerTransactions.quantity,
        ticketReference: tonerTransactions.ticketReference,
        createdAt: tonerTransactions.createdAt,
        tonerName: tonerTypes.name,
        officeName: locations.name,
        departmentName: departments.name,
        subunitName: subunits.name,
        itsName: itsNames.name,
      }).from(tonerTransactions)
        .innerJoin(tonerTypes, eq(tonerTypes.id, tonerTransactions.tonerTypeId))
        .leftJoin(locations, eq(locations.id, tonerTransactions.locationId))
        .leftJoin(departments, eq(departments.id, tonerTransactions.departmentId))
        .leftJoin(subunits, eq(subunits.id, tonerTransactions.subunitId))
        .leftJoin(itsNames, eq(itsNames.id, tonerTransactions.itsNameId))
        .orderBy(desc(tonerTransactions.createdAt), desc(tonerTransactions.id))
        .limit(SOURCE_LIMIT)
      : Promise.resolve([]),
    access.repair
      ? db.select({
        id: repairTickets.id,
        ticketNumber: repairTickets.ticketNumber,
        serialNumber: repairTickets.serialNumber,
        status: repairTickets.status,
        createdAt: repairTickets.createdAt,
        updatedAt: repairTickets.updatedAt,
        officeName: locations.name,
      }).from(repairTickets)
        .leftJoin(locations, eq(locations.id, repairTickets.locationId))
        .orderBy(desc(repairTickets.updatedAt), desc(repairTickets.id))
        .limit(SOURCE_LIMIT)
      : Promise.resolve([]),
    access.monitoring_alerts
      ? db.select({
        id: printerAlerts.id,
        type: printerAlerts.type,
        severity: printerAlerts.severity,
        message: printerAlerts.message,
        startedAt: printerAlerts.startedAt,
        resolvedAt: printerAlerts.resolvedAt,
        serialNumber: printers.serialNumber,
        model: printers.model,
        officeName: locations.name,
      }).from(printerAlerts)
        .innerJoin(printers, eq(printers.id, printerAlerts.printerId))
        .leftJoin(locations, eq(locations.id, printers.locationId))
        .orderBy(desc(sql`coalesce(${printerAlerts.resolvedAt}, ${printerAlerts.startedAt})`), desc(printerAlerts.id))
        .limit(SOURCE_LIMIT)
      : Promise.resolve([]),
    access.registrations
      ? db.select({
        id: userRegistrationRequests.id,
        fullName: userRegistrationRequests.fullName,
        status: userRegistrationRequests.status,
        createdAt: userRegistrationRequests.createdAt,
        reviewedAt: userRegistrationRequests.reviewedAt,
      }).from(userRegistrationRequests)
        .orderBy(desc(sql`coalesce(${userRegistrationRequests.reviewedAt}, ${userRegistrationRequests.createdAt})`), desc(userRegistrationRequests.id))
        .limit(SOURCE_LIMIT)
      : Promise.resolve([]),
    access.printer_records
      ? db.select({
        id: printers.id,
        serialNumber: printers.serialNumber,
        model: printers.model,
        status: printers.status,
        createdAt: printers.createdAt,
        updatedAt: printers.updatedAt,
        officeName: locations.name,
      }).from(printers)
        .leftJoin(locations, eq(locations.id, printers.locationId))
        .orderBy(desc(printers.updatedAt), desc(printers.id))
        .limit(SOURCE_LIMIT)
      : Promise.resolve([]),
    access.monitoring_alerts && canManageAgents
      ? db.select({
        id: monitoringAgents.id,
        name: monitoringAgents.name,
        createdAt: monitoringAgents.createdAt,
        officeName: locations.name,
      }).from(monitoringAgents)
        .leftJoin(locations, eq(locations.id, monitoringAgents.locationId))
        .orderBy(desc(monitoringAgents.createdAt), desc(monitoringAgents.id))
        .limit(SOURCE_LIMIT)
      : Promise.resolve([]),
  ]);

  const activities: RecentActivityItem[] = [];

  for (const row of tonerRows) {
    const status = normalizeTonerTransactionStatus(row.type);
    const organization = compactJoin([row.officeName, row.departmentName, row.subunitName]);
    activities.push({
      id: `toner-${row.id}`,
      category: "toner",
      title: status === "Request"
        ? "Toner requested"
        : status === "Purchase"
          ? "Toner purchase recorded"
          : "Toner delivered",
      detail: `${row.quantity} × ${row.tonerName}${organization ? ` · ${organization}` : ""}`,
      meta: compactJoin([row.itsName ? `ITS: ${row.itsName}` : null, row.ticketReference ? `Ticket/RQ: ${row.ticketReference}` : null]),
      occurredAt: new Date(row.createdAt),
      href: `/toner-monitoring/${row.id}/edit`,
    });
  }

  for (const row of repairRows) {
    const createdAt = new Date(row.createdAt);
    const updatedAt = new Date(row.updatedAt);
    const changed = updatedAt.getTime() - createdAt.getTime() > 1_000;
    const closed = row.status.trim().toLowerCase() === "closed";
    activities.push({
      id: `repair-${row.id}`,
      category: "repair",
      title: closed ? "Repair ticket closed" : changed ? "Repair ticket updated" : "Repair ticket created",
      detail: `${row.ticketNumber} · ${row.serialNumber}${row.officeName ? ` · ${row.officeName}` : ""}`,
      meta: `Status: ${row.status}`,
      occurredAt: changed ? updatedAt : createdAt,
      href: `/repair-history/${row.id}`,
    });
  }

  for (const row of alertRows) {
    const resolved = Boolean(row.resolvedAt);
    activities.push({
      id: `alert-${row.id}-${resolved ? "resolved" : "active"}`,
      category: "alert",
      title: resolved ? "Printer alert resolved" : "Printer alert detected",
      detail: compactJoin([row.model, row.serialNumber, row.officeName]),
      meta: `${row.severity} · ${row.message || row.type}`,
      occurredAt: new Date(row.resolvedAt ?? row.startedAt),
      href: "/printdash/alerts",
    });
  }

  for (const row of registrationRows) {
    const reviewed = Boolean(row.reviewedAt);
    const status = row.status.trim().toLowerCase();
    activities.push({
      id: `registration-${row.id}-${reviewed ? status : "submitted"}`,
      category: "account",
      title: status === "approved" ? "Registration approved" : status === "rejected" ? "Registration rejected" : status === "pending_admin" ? "Registration ready for approval" : "Registration submitted",
      detail: row.fullName,
      meta: registrationStatusLabel(status),
      occurredAt: new Date(row.reviewedAt ?? row.createdAt),
      href: `/manage/registrations/${row.id}`,
    });
  }

  for (const row of printerRows) {
    const createdAt = new Date(row.createdAt);
    const updatedAt = new Date(row.updatedAt);
    const changed = updatedAt.getTime() - createdAt.getTime() > 1_000;
    activities.push({
      id: `printer-${row.id}`,
      category: "printer",
      title: changed ? "Printer record updated" : "Printer added",
      detail: compactJoin([row.model, row.serialNumber, row.officeName]),
      meta: `Asset status: ${row.status}`,
      occurredAt: changed ? updatedAt : createdAt,
      href: `/printers/${row.id}`,
    });
  }

  for (const row of agentRows) {
    activities.push({
      id: `agent-${row.id}`,
      category: "agent",
      title: "Monitoring agent registered",
      detail: compactJoin([row.name, row.officeName]),
      occurredAt: new Date(row.createdAt),
      href: `/monitoring-agents/${row.id}`,
    });
  }

  return activities
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime() || left.id.localeCompare(right.id))
    .slice(0, Math.max(1, limit));
}

function compactJoin(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).filter(Boolean).join(" · ");
}

function registrationStatusLabel(status: string) {
  if (status === "approved") return "Account is active";
  if (status === "rejected") return "Registration was declined";
  if (status === "pending_admin") return "Awaiting administrator approval";
  if (status === "pending_email") return "Awaiting email verification";
  return `Status: ${status.replaceAll("_", " ")}`;
}
