"use client";

import { useEffect } from "react";
import {
  notifyMonitoringFailure,
  notifyPrinterOffline,
  notifyPrinterRecovered,
  notifyPrinterWarning,
} from "@/lib/toast-notifications";

const STORAGE_KEY = "seaoil-printdash-toast-state-v1";

export type PrinterToastSnapshot = {
  id: number;
  label: string;
  online: boolean | null;
  stale: boolean;
  warningKey: string | null;
  warningType: string | null;
};

type StoredPrinterState = Pick<
  PrinterToastSnapshot,
  "online" | "stale" | "warningKey"
>;

export default function PrintDashStatusToasts({
  printers,
}: {
  printers: PrinterToastSnapshot[];
}) {
  useEffect(() => {
    let previous: Record<string, StoredPrinterState> = {};
    try {
      previous = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "{}");
    } catch {
      previous = {};
    }

    for (const printer of printers) {
      const prior = previous[String(printer.id)];
      if (!prior) continue;

      if (prior.online === true && printer.online === false) {
        notifyPrinterOffline(printer.id, printer.label);
      } else if (prior.online === false && printer.online === true) {
        notifyPrinterRecovered(printer.id, printer.label);
      }

      if (!prior.stale && printer.stale) {
        notifyMonitoringFailure(printer.id, printer.label);
      }

      if (
        printer.warningKey &&
        printer.warningType &&
        printer.warningKey !== prior.warningKey
      ) {
        notifyPrinterWarning(printer.id, printer.label, printer.warningType);
      }
    }

    const nextState = Object.fromEntries(
      printers.map((printer) => [
        String(printer.id),
        {
          online: printer.online,
          stale: printer.stale,
          warningKey: printer.warningKey,
        },
      ]),
    );
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
    } catch {
      // Toast transitions remain best-effort when browser storage is unavailable.
    }
  }, [printers]);

  return null;
}
