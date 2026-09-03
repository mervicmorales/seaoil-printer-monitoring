import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
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
import {
  Activity,
  Building2,
  FileText,
  Printer,
  RefreshCw,
  Wrench,
  type IconNode,
} from "lucide";
import { PageHeader, Card, TableCard, Badge, statusBadgeColor, SecondaryButton, EmptyState, IconGlyph } from "@/components/ui";
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
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition hover:bg-red-100"
                  /> : <button type="button" disabled className="cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400">Delete Printer</button>}
                </>
              )}
            </>
          }
        />
      )}
      <SuccessBanner message={sp.success} showInline={false} />

      <Tabs
        tabs={[
          {
            key: "details",
            label: "Printer Details",
            icon: Printer,
            content: (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <InfoSection
                  title="Asset information"
                  description="Identity and ownership details"
                  icon={Printer}
                >
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                    <Field label="Asset Tag" value={p.assetTag || "—"} />
                    <Field label="Model" value={p.model || "—"} />
                    <Field label="Serial Number" value={p.serialNumber} mono />
                    <Field label="Assigned User" value={p.assignedUser || "—"} />
                    <div className="sm:col-span-2">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">Asset Status</dt>
                      <dd className="mt-2"><Badge color={statusBadgeColor(p.status)}>{p.status}</Badge></dd>
                    </div>
                  </dl>
                </InfoSection>

                <InfoSection
                  title="Assignment"
                  description="Network and physical placement"
                  icon={Building2}
                >
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
                    <Field label="Location" value={record.locationName || "—"} />
                    <Field label="Department" value={record.departmentName || "—"} />
                    <div className="sm:col-span-2">
                      <Field label="IP Address" value={p.ipAddress || "—"} mono />
                    </div>
                  </dl>
                </InfoSection>

                <InfoSection
                  title="Service and contract"
                  description="Commercial and support information"
                  icon={FileText}
                  className="lg:col-span-2"
                >
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                    <Field
                      label="Toner Type / Monthly Rate"
                      value={`${toners.map((t) => t.name).join(", ") || "—"} / ${formatPHP(p.monthlyRate)}`}
                    />
                    <Field label="Vendor / Supplier" value={record.vendorName || "—"} />
                    <Field label="Contract Number" value={record.contractNumber || "—"} mono />
                    <Field label="Warranty / End-of-Contract" value={formatDate(record.contractEnd)} />
                  </dl>
                </InfoSection>
              </div>
            ),
          },
          {
            key: "monitoring",
            label: "Live Monitoring",
            icon: Activity,
            content: (
              <Card className="overflow-hidden">
                  <div className="flex flex-col justify-between gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 items-center justify-center rounded-lg bg-sky-50 text-[#014171]">
                          <IconGlyph icon={Activity} size={16} />
                        </span>
                        <h3 className="font-bold tracking-[-0.01em] text-[#014171]">Live Monitoring</h3>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        Latest read-only observation received from PrintDash.
                      </p>
                    </div>
                    {latestMonitoring && (
                      <p className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-500 shadow-sm">
                        Last checked {formatDateTime(latestMonitoring.checkedAt)}
                      </p>
                    )}
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                      <dl className="mt-5 grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
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

                      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
                        <section className="rounded-xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
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
                                  printerModel={record.printer.model}
                                />
                              ))}
                            </div>
                          )}
                        </section>

                        <section className="rounded-xl border border-slate-200 p-5">
                          <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
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
                                  className="rounded-xl border border-slate-200 bg-slate-50/40 px-4 py-3"
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
                  </div>
              </Card>
            ),
          },
          {
            key: "repair",
            label: "Repair History",
            icon: Wrench,
            content: (
              <TableCard className="h-[30rem]">
                <HistoryHeader
                  title="Repair history"
                  description="Service tickets recorded for this printer"
                  count={tickets.length}
                  icon={Wrench}
                />
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
                          <td className="px-4 py-3 font-semibold text-[#014171]">{t.ticketNumber}</td>
                          <td className="px-4 py-3">{formatDate(t.requestedDate)}</td>
                          <td className="px-4 py-3 font-mono text-xs">{t.serialNumber}</td>
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
            icon: RefreshCw,
            content: (
              <TableCard className="h-[30rem]">
                <HistoryHeader
                  title="Replacement history"
                  description="Serial-number changes retained for this asset"
                  count={replacements.length}
                  icon={RefreshCw}
                />
                {replacements.length === 0 ? (
                  <EmptyState message="No replacement history recorded for this printer." />
                ) : (
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Replacement Date</th>
                        <th className="px-4 py-3">Old Serial Number</th>
                        <th className="px-4 py-3">New Serial Number</th>
                        <th className="px-4 py-3">Model</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {replacements.map((r) => (
                        <tr key={r.id}>
                          <td className="px-4 py-3">{formatDate(r.replacementDate)}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.oldSerialNumber}</td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[#014171]">{r.newSerialNumber}</td>
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

function InfoSection({
  title,
  description,
  icon,
  className = "",
  children,
}: {
  title: string;
  description: string;
  icon: IconNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
          <IconGlyph icon={icon} size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#014171]">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function HistoryHeader({
  title,
  description,
  count,
  icon,
}: {
  title: string;
  description: string;
  count: number;
  icon: IconNode;
}) {
  return (
    <div className="sticky left-0 flex min-w-full items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
          <IconGlyph icon={icon} size={17} />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#014171]">{title}</h3>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
        {count}
      </span>
    </div>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.1em] text-slate-500">{label}</dt>
      <dd className={`mt-1.5 break-words text-sm font-semibold leading-5 text-slate-800 ${mono ? "font-mono text-[13px]" : ""}`}>{value}</dd>
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
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3.5">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-0.5 ${statusAccentColor(color)}`} />
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-slate-500">{label}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge color={color}>{value}</Badge>
        {detail && <span className="text-xs text-slate-500">{detail}</span>}
      </div>
    </div>
  );
}

function ConsumableLevel({
  consumable,
  printerModel,
}: {
  consumable: {
    name: string;
    type: string;
    levelPercent: number | null;
    status: string | null;
    isUnknown: boolean;
  };
  printerModel: string | null;
}) {
  const isUnknown = consumable.isUnknown || consumable.levelPercent === null;
  const percentage = isUnknown ? 0 : consumable.levelPercent ?? 0;
  const displayName = monitoringConsumableDisplayName(
    consumable.name,
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

function statusAccentColor(
  color: "green" | "yellow" | "red" | "blue" | "gray" | "orange",
) {
  return {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-sky-500",
    gray: "bg-slate-400",
    orange: "bg-orange-500",
  }[color];
}

function monitoringConsumableDisplayName(
  name: string,
  printerModel: string | null,
) {
  const printerIdentity = (printerModel ?? "").toLowerCase();
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
