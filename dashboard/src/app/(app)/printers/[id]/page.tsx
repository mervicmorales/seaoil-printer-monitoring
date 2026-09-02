import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import {
  printers,
  locations,
  departments,
  vendors,
  contracts,
  printerTonerTypes,
  tonerTypes,
  repairTickets,
  replacementHistory,
  printerMonitoringReadings,
  printerConsumableReadings,
  printerAlerts,
} from "@/db/schema";
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { PageHeader, Card, TableCard, Badge, statusBadgeColor, SecondaryButton, EmptyState } from "@/components/ui";
import { formatDate, formatPHP } from "@/lib/format";
import Tabs from "@/components/Tabs";
import SuccessBanner from "@/components/SuccessBanner";
import DeleteButton from "@/components/DeleteButton";
import { getModuleAccessMap, requireSession } from "@/lib/server-utils";
import { normalizePrinterReturnTo } from "@/lib/printer-navigation";
import { deletePrinterAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PrinterViewPage({
  params,
  searchParams,
  embedded = false,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ success?: string; returnTo?: string }>;
  embedded?: boolean;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const returnTo = normalizePrinterReturnTo(sp.returnTo);
  const session = await requireSession();
  const access = await getModuleAccessMap(session.id, session.role);
  const printerId = Number(id);
  if (!Number.isInteger(printerId) || printerId <= 0) notFound();

  const rows = await db
    .select({
      printer: printers,
      locationName: locations.name,
      departmentName: departments.name,
      vendorName: vendors.name,
      vendorEmail: vendors.email,
      contractNumber: contracts.contractNumber,
      contractEnd: contracts.endDate,
    })
    .from(printers)
    .leftJoin(locations, eq(printers.locationId, locations.id))
    .leftJoin(departments, eq(printers.departmentId, departments.id))
    .leftJoin(vendors, eq(printers.vendorId, vendors.id))
    .leftJoin(contracts, eq(printers.contractId, contracts.id))
    .where(eq(printers.id, printerId))
    .limit(1);

  const record = rows[0];
  if (!record) notFound();

  const toners = await db
    .select({ name: tonerTypes.name })
    .from(printerTonerTypes)
    .innerJoin(tonerTypes, eq(printerTonerTypes.tonerTypeId, tonerTypes.id))
    .where(eq(printerTonerTypes.printerId, printerId));

  const tickets = await db
    .select({
      ticketNumber: repairTickets.ticketNumber,
      requestedDate: repairTickets.requestedDate,
      serialNumber: repairTickets.serialNumber,
      locationName: locations.name,
      departmentName: departments.name,
      problem: repairTickets.problem,
      vendorName: vendors.name,
      status: repairTickets.status,
    })
    .from(repairTickets)
    .leftJoin(locations, eq(repairTickets.locationId, locations.id))
    .leftJoin(departments, eq(repairTickets.departmentId, departments.id))
    .leftJoin(vendors, eq(repairTickets.vendorId, vendors.id))
    .where(eq(repairTickets.printerId, printerId))
    .orderBy(desc(repairTickets.requestedDate));

  const replacements = await db
    .select()
    .from(replacementHistory)
    .where(eq(replacementHistory.printerId, printerId))
    .orderBy(desc(replacementHistory.replacementDate));

  const [latestMonitoring] = await db
    .select({
      id: printerMonitoringReadings.id,
      checkedAt: printerMonitoringReadings.checkedAt,
      online: printerMonitoringReadings.online,
      printerStatus: printerMonitoringReadings.printerStatus,
      pageCount: printerMonitoringReadings.pageCount,
      uptimeSeconds: printerMonitoringReadings.uptimeSeconds,
    })
    .from(printerMonitoringReadings)
    .where(eq(printerMonitoringReadings.printerId, printerId))
    .orderBy(
      desc(printerMonitoringReadings.checkedAt),
      desc(printerMonitoringReadings.id),
    )
    .limit(1);

  const [latestConsumables, activeAlerts] = await Promise.all([
    latestMonitoring
      ? db
          .select({
            id: printerConsumableReadings.id,
            name: printerConsumableReadings.name,
            type: printerConsumableReadings.type,
            levelPercent: printerConsumableReadings.levelPercent,
            status: printerConsumableReadings.status,
            isUnknown: printerConsumableReadings.isUnknown,
          })
          .from(printerConsumableReadings)
          .where(
            eq(
              printerConsumableReadings.monitoringReadingId,
              latestMonitoring.id,
            ),
          )
          .orderBy(asc(printerConsumableReadings.name))
      : Promise.resolve([]),
    db
      .select({
        id: printerAlerts.id,
        type: printerAlerts.type,
        severity: printerAlerts.severity,
        message: printerAlerts.message,
        startedAt: printerAlerts.startedAt,
      })
      .from(printerAlerts)
      .where(
        and(
          eq(printerAlerts.printerId, printerId),
          isNull(printerAlerts.resolvedAt),
        ),
      )
      .orderBy(desc(printerAlerts.startedAt)),
  ]);

  const p = record.printer;
  const activeRepairTicket = tickets.find(
    (ticket) => ticket.status === "Open" || ticket.status === "In Progress",
  );

  return (
    <div>
      {!embedded && (
        <PageHeader
          title={`${record.locationName || "—"} / ${record.departmentName || "—"}`}
          subtitle={`${p.serialNumber} / ${p.ipAddress || "—"}`}
          actions={
            <>
              {access.printers && (
                <>
                  <Link href={`/printers/${p.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}>
                    <SecondaryButton>Edit Printer</SecondaryButton>
                  </Link>
                  {session.role === "admin" ? <DeleteButton
                    action={deletePrinterAction}
                    id={p.id}
                    confirmText="Delete this printer? This cannot be undone."
                    label="Delete Printer"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                  /> : <button type="button" disabled className="cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400">Delete Printer</button>}
                </>
              )}
            </>
          }
        />
      )}
      <SuccessBanner message={sp.success} />

      <Tabs
        tabs={[
          {
            key: "details",
            label: "Printer Details",
            content: (
              <Card className="p-6">
                <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Asset Tag" value={p.assetTag || "—"} />
                  <Field label="Brand / Model" value={`${p.brand || "—"} / ${p.model || "—"}`} />
                  <Field
                    label="Toner Type / Monthly Rate"
                    value={`${toners.map((t) => t.name).join(", ") || "—"} / ${formatPHP(p.monthlyRate)}`}
                  />
                  <Field label="Vendor / Supplier" value={record.vendorName || "—"} />
                  <Field label="Contract Number" value={record.contractNumber || "—"} />
                  <Field label="Warranty / End-of-Contract" value={formatDate(record.contractEnd)} />
                  <Field label="Assigned User" value={p.assignedUser || "—"} />
                </dl>
              </Card>
            ),
          },
          {
            key: "monitoring",
            label: "Live Monitoring",
            content: (
              <Card className="p-6">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                    <div>
                      <h3 className="font-bold text-[#014171]">Live Monitoring</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        Latest read-only observation received from PrintDash.
                      </p>
                    </div>
                    {latestMonitoring && (
                      <p className="text-xs text-slate-500">
                        Last checked {formatDateTime(latestMonitoring.checkedAt)}
                      </p>
                    )}
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <StatusBlock
                      label="Asset Lifecycle Status"
                      value={p.status}
                      color={statusBadgeColor(p.status)}
                    />
                    <StatusBlock
                      label="Ticket Status"
                      value={activeRepairTicket?.status ?? "No Open Ticket"}
                      detail={activeRepairTicket?.ticketNumber}
                      color={
                        activeRepairTicket
                          ? statusBadgeColor(activeRepairTicket.status)
                          : "blue"
                      }
                    />
                    <StatusBlock
                      label="Monitoring Status"
                      value={
                        latestMonitoring
                          ? latestMonitoring.online
                            ? "Online"
                            : "Offline"
                          : "Not Monitored"
                      }
                      color={
                        latestMonitoring
                          ? latestMonitoring.online
                            ? "green"
                            : "red"
                          : "gray"
                      }
                    />
                  </div>

                  {!latestMonitoring ? (
                    <EmptyState message="No monitoring readings have been received for this printer yet." />
                  ) : (
                    <>
                      <dl className="mt-6 grid grid-cols-1 gap-5 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                        <Field
                          label="Last Checked"
                          value={formatDateTime(latestMonitoring.checkedAt)}
                        />
                        <Field
                          label="Printer Status"
                          value={latestMonitoring.printerStatus || "Unknown"}
                        />
                        <Field
                          label="Page Count"
                          value={formatCounter(latestMonitoring.pageCount)}
                        />
                        <Field
                          label="Uptime"
                          value={formatUptime(latestMonitoring.uptimeSeconds)}
                        />
                      </dl>

                      <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-100 pt-5 lg:grid-cols-2">
                        <section>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Consumable Levels
                          </h4>
                          {latestConsumables.length === 0 ? (
                            <p className="mt-3 text-sm text-slate-500">
                              No consumable readings reported.
                            </p>
                          ) : (
                            <div className="mt-3 space-y-4">
                              {latestConsumables.map((consumable) => (
                                <ConsumableLevel
                                  key={consumable.id}
                                  consumable={consumable}
                                  printerBrand={record.printer.brand}
                                  printerModel={record.printer.model}
                                />
                              ))}
                            </div>
                          )}
                        </section>

                        <section>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Active Alerts
                          </h4>
                          {activeAlerts.length === 0 ? (
                            <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                              No active monitoring alerts.
                            </div>
                          ) : (
                            <div className="mt-3 space-y-3">
                              {activeAlerts.map((alert) => (
                                <div
                                  key={alert.id}
                                  className="rounded-lg border border-slate-200 px-4 py-3"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Badge color={alertBadgeColor(alert.severity)}>
                                      {alert.severity}
                                    </Badge>
                                    <span className="text-xs font-medium text-slate-500">
                                      {humanize(alert.type)}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm text-slate-700">{alert.message}</p>
                                  <p className="mt-1 text-xs text-slate-400">
                                    Started {formatDateTime(alert.startedAt)}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </div>
                    </>
                  )}
              </Card>
            ),
          },
          {
            key: "repair",
            label: "Repair History",
            content: (
              <TableCard>
                {tickets.length === 0 ? (
                  <EmptyState message="No repair history recorded for this printer." />
                ) : (
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Ticket #</th>
                        <th className="px-4 py-3">Requested Date</th>
                        <th className="px-4 py-3">Serial Number</th>
                        <th className="px-4 py-3">Location</th>
                        <th className="px-4 py-3">Department</th>
                        <th className="px-4 py-3">Problem</th>
                        <th className="px-4 py-3">Vendor</th>
                        <th className="px-4 py-3">Ticket Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {tickets.map((t) => (
                        <tr key={t.ticketNumber}>
                          <td className="px-4 py-3 font-medium">{t.ticketNumber}</td>
                          <td className="px-4 py-3">{formatDate(t.requestedDate)}</td>
                          <td className="px-4 py-3">{t.serialNumber}</td>
                          <td className="px-4 py-3">{t.locationName || "—"}</td>
                          <td className="px-4 py-3">{t.departmentName || "—"}</td>
                          <td className="px-4 py-3 max-w-xs truncate" title={t.problem}>{t.problem}</td>
                          <td className="px-4 py-3">{t.vendorName || "—"}</td>
                          <td className="px-4 py-3"><Badge color={statusBadgeColor(t.status)}>{t.status}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </TableCard>
            ),
          },
          {
            key: "replacement",
            label: "Replacement History",
            content: (
              <TableCard>
                {replacements.length === 0 ? (
                  <EmptyState message="No replacement history recorded for this printer." />
                ) : (
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Replacement Date</th>
                        <th className="px-4 py-3">Old Serial Number</th>
                        <th className="px-4 py-3">New Serial Number</th>
                        <th className="px-4 py-3">Brand</th>
                        <th className="px-4 py-3">Model</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {replacements.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3">{formatDate(r.replacementDate)}</td>
                          <td className="px-4 py-3">{r.oldSerialNumber}</td>
                          <td className="px-4 py-3">{r.newSerialNumber}</td>
                          <td className="px-4 py-3">{r.brand}</td>
                          <td className="px-4 py-3">{r.model}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </TableCard>
            ),
          },
        ]}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value}</p>
    </div>
  );
}

function StatusBlock({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail?: string;
  color: "green" | "yellow" | "red" | "blue" | "gray" | "orange";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge color={color}>{value}</Badge>
        {detail && <span className="text-xs text-slate-500">{detail}</span>}
      </div>
    </div>
  );
}

function ConsumableLevel({
  consumable,
  printerBrand,
  printerModel,
}: {
  consumable: {
    name: string;
    type: string;
    levelPercent: number | null;
    status: string | null;
    isUnknown: boolean;
  };
  printerBrand: string | null;
  printerModel: string | null;
}) {
  const isUnknown = consumable.isUnknown || consumable.levelPercent === null;
  const percentage = isUnknown ? 0 : consumable.levelPercent ?? 0;
  const displayName = monitoringConsumableDisplayName(
    consumable.name,
    printerBrand,
    printerModel,
  );
  const unknownLabel =
    consumable.status && consumable.status.toLowerCase() !== "unknown"
      ? consumable.status
      : "Unknown";
  const barColor = percentage <= 10 ? "bg-red-500" : percentage <= 20 ? "bg-amber-400" : "bg-[#014171]";

  return (
    <div>
      <div className="flex items-start justify-between gap-3 text-sm">
        <div>
          <p className="font-medium text-slate-700" title={consumable.name}>
            {displayName}
          </p>
          <p className="text-xs capitalize text-slate-400">
            {humanize(consumable.type)}
            {!isUnknown && ` · ${consumable.status || "Unknown"}`}
          </p>
        </div>
        <span className="font-semibold text-slate-700">
          {isUnknown ? unknownLabel : `${percentage}%`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        {!isUnknown && (
          <div
            className={`h-full rounded-full ${barColor}`}
            style={{ width: `${percentage}%` }}
          />
        )}
      </div>
    </div>
  );
}

function monitoringConsumableDisplayName(
  name: string,
  printerBrand: string | null,
  printerModel: string | null,
) {
  const printerIdentity = `${printerBrand ?? ""} ${printerModel ?? ""}`.toLowerCase();
  if (
    printerIdentity.includes("canon") &&
    printerIdentity.includes("mf244w") &&
    /\b337\b/.test(name)
  ) {
    return "B 283X";
  }

  return name;
}

function formatDateTime(value: Date) {
  return value.toLocaleString("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  });
}

function formatCounter(value: number | null) {
  return value === null ? "Unknown" : new Intl.NumberFormat("en-PH").format(value);
}

function formatUptime(seconds: number | null) {
  if (seconds === null) return "Unknown";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  return [days ? `${days}d` : "", hours ? `${hours}h` : "", `${minutes}m`]
    .filter(Boolean)
    .join(" ");
}

function alertBadgeColor(
  severity: string,
): "green" | "yellow" | "red" | "blue" | "gray" | "orange" {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "error") return "red";
  if (normalized === "warning") return "yellow";
  return "blue";
}

function humanize(value: string) {
  return value.replace(/[-_]+/g, " ");
}
