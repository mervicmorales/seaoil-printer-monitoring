const PRINTER_RETURN_ROUTES = [
  "/printers",
  "/printdash",
  "/printdash/alerts",
  "/printdash/discover",
] as const;

export function normalizePrinterReturnTo(value?: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/printers";

  try {
    const url = new URL(value, "http://printer-monitoring.local");
    const route = PRINTER_RETURN_ROUTES.find((candidate) => candidate === url.pathname);
    if (route) return `${route}${url.search}`;
    if (/^\/contracts\/\d+$/.test(url.pathname)) {
      return `${url.pathname}${url.search}`;
    }
    return "/printers";
  } catch {
    return "/printers";
  }
}

export function printerDetailHref(printerId: number, returnTo: string) {
  return `/printers/${printerId}?returnTo=${encodeURIComponent(normalizePrinterReturnTo(returnTo))}`;
}
