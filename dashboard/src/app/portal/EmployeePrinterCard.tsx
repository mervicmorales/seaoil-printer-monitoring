"use client";

import { useState } from "react";
import { Droplets, Flag, Info, Printer, type IconNode } from "lucide";
import {
  Badge,
  Card,
  IconGlyph,
  SecondaryButton,
  statusBadgeColor,
} from "@/components/ui";
import CompactConsumableLevel, { type CompactConsumable } from "@/components/CompactConsumableLevel";
import LiveMonitoringBadge from "@/components/LiveMonitoringBadge";

type BadgeColor = "green" | "yellow" | "red" | "blue" | "gray" | "orange";

type PrinterAlert = {
  type: string;
  severity: string;
  message: string;
};

export default function EmployeePrinterCard({
  printer,
  monitoring,
  alerts,
  consumables,
  showNetworkDetails = false,
}: {
  printer: {
    serialNumber: string;
    model: string | null;
    locationName: string | null;
    departmentName: string | null;
    subunitName: string | null;
    floor: string | null;
    ipAddress: string | null;
    macAddress: string | null;
    status: string;
  };
  monitoring: { label: string; color: BadgeColor };
  alerts: PrinterAlert[];
  consumables: CompactConsumable[];
  showNetworkDetails?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"details" | "consumables">("details");

  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/50 p-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-[#014171]">
            <IconGlyph icon={Printer} size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Serial Number</p>
            <h3 className="mt-1 break-words font-mono text-base font-bold text-slate-800">{printer.serialNumber}</h3>
          </div>
        </div>
        <div className="shrink-0 sm:text-right">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Monitoring Status</p>
          <LiveMonitoringBadge label={monitoring.label} color={monitoring.color} />
        </div>
      </div>

      <div className="flex border-b border-slate-200 bg-white px-4" role="tablist" aria-label={`Printer ${printer.serialNumber} information`}>
        <TabButton
          active={activeTab === "details"}
          icon={Info}
          label="Printer Details"
          onClick={() => setActiveTab("details")}
        />
        <TabButton
          active={activeTab === "consumables"}
          icon={Droplets}
          label="Consumable Levels"
          count={consumables.length}
          onClick={() => setActiveTab("consumables")}
        />
      </div>

      <div className="flex-1 p-5">
        {activeTab === "details" ? (
          <div role="tabpanel">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              <PrinterDetail label="Model" value={printer.model} />
              <PrinterDetail label="Office" value={printer.locationName} />
              <PrinterDetail label="Location" value={printer.floor} />
              <PrinterDetail label="Department" value={printer.departmentName} />
              <PrinterDetail label="Sub-unit" value={printer.subunitName} />
              {showNetworkDetails && <PrinterDetail label="IP Address" value={printer.ipAddress} mono />}
              {showNetworkDetails && <PrinterDetail label="MAC Address" value={printer.macAddress} mono />}
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Asset Status</dt>
                <dd className="mt-1.5"><Badge color={statusBadgeColor(printer.status)}>{printer.status}</Badge></dd>
              </div>
            </dl>

            <section className="mt-5 border-t border-slate-100 pt-5">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">Alerts</h4>
                {alerts.length > 0 && <Badge color="yellow">{alerts.length} active</Badge>}
              </div>
              {alerts.length === 0 ? (
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3.5 py-3 text-xs font-medium text-emerald-700">
                  No active alerts
                </div>
              ) : (
                <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                  {alerts.map((alert, index) => (
                    <li key={`${alert.type}-${alert.message}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex flex-wrap items-start gap-2">
                        <Badge color={alertSeverityColor(alert.severity)}>{alert.severity}</Badge>
                        <p className="min-w-0 flex-1 text-xs leading-5 text-slate-600">{alert.message}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : (
          <section role="tabpanel" aria-label="Consumable levels">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-[#014171]">Consumable Levels</h4>
                <p className="mt-0.5 text-xs text-slate-500">Latest readings reported by the monitoring agent.</p>
              </div>
              <Badge color={consumables.length > 0 ? "blue" : "gray"}>{consumables.length} items</Badge>
            </div>
            {consumables.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500">
                No consumable readings are available.
              </div>
            ) : (
              <div className="grid max-h-72 grid-cols-1 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {consumables.map((consumable, index) => (
                  <CompactConsumableLevel key={`${consumable.type}-${consumable.name}-${index}`} consumable={consumable} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50/40 p-4">
        <SecondaryButton
          type="button"
          disabled
          title="Printer reporting will be available soon."
          className="w-full"
        >
          <IconGlyph icon={Flag} size={15} />
          Report this printer
        </SecondaryButton>
      </div>
    </Card>
  );
}

function TabButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: IconNode;
  label: string;
  count?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`relative inline-flex min-h-11 items-center gap-2 px-3 text-xs font-semibold transition sm:text-sm ${
        active ? "text-[#014171]" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <IconGlyph icon={icon} size={14} />
      <span>{label}</span>
      {count !== undefined && (
        <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500"}`}>
          {count}
        </span>
      )}
      {active && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#014171]" />}
    </button>
  );
}

function PrinterDetail({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">{label}</dt>
      <dd className={`mt-1.5 break-words text-sm font-medium text-slate-700 ${mono ? "font-mono" : ""}`}>
        {value || "—"}
      </dd>
    </div>
  );
}

function alertSeverityColor(severity: string): BadgeColor {
  const normalized = severity.toLowerCase();
  if (normalized === "critical" || normalized === "error") return "red";
  if (normalized === "warning") return "yellow";
  if (normalized === "info" || normalized === "informational") return "blue";
  return "gray";
}
