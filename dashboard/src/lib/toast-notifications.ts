"use client";

import { gooeyToast } from "goey-toast";

function printerToastId(printerId: number, eventType: string) {
  return `printer-${printerId}-${eventType}`;
}

export function notifyPrinterOffline(printerId: number, printerLabel: string) {
  gooeyToast.error("Printer offline", {
    id: printerToastId(printerId, "connectivity"),
    description: `${printerLabel} stopped responding to monitoring.`,
  });
}

export function notifyPrinterRecovered(printerId: number, printerLabel: string) {
  gooeyToast.success("Printer recovered", {
    id: printerToastId(printerId, "connectivity"),
    description: `${printerLabel} is responding to monitoring again.`,
  });
}

export function notifyPrinterWarning(
  printerId: number,
  printerLabel: string,
  warningType: string,
) {
  const title =
    warningType === "low-consumable"
      ? "Low consumable"
      : warningType === "paper-warning"
        ? "Paper warning"
        : "Printer warning";
  gooeyToast.warning(title, {
    id: printerToastId(printerId, "warning"),
    description: `${printerLabel} requires attention. Check its persistent monitoring status for details.`,
  });
}

export function notifyMonitoringFailure(printerId: number, printerLabel: string) {
  gooeyToast.error("Monitoring update delayed", {
    id: printerToastId(printerId, "monitoring-failure"),
    description: `No recent monitoring update is available for ${printerLabel}.`,
  });
}

export function notifyActionSuccess(messageKey: string) {
  gooeyToast.success("Action completed", {
    id: `action-success-${stableHash(messageKey)}`,
    description: "The requested change was saved successfully.",
  });
}

export function notifyActionPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  },
) {
  gooeyToast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
    description: {
      error: "The request could not be completed. Please try again.",
    },
    timing: {
      displayDuration: 3500,
    },
    spring: false,
    preset: "subtle",
  });
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(36);
}
