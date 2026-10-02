import { createElement, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, Inbox, type IconNode } from "lucide";
import { PageHeaderPortal } from "@/components/PageHeaderPortal";

function pageHeaderSection(title: string) {
  const normalized = title.toLowerCase();
  if (normalized.includes("printer services") || normalized.includes("printops") || normalized.includes("available printers")) return "Printer Services";
  if (normalized.includes("toner")) return "Toners";
  if (normalized.includes("contract")) return "Contracts";
  if (normalized.includes("registration")) return "Registrations";
  if (normalized.includes("account") || normalized.includes("user management")) return "User Management";
  if (normalized.includes("overview")) return "Dashboard";
  if (normalized.includes("system")) return "Administration";
  if (["printer", "repair", "ticket", "monitoring agent", "monitoring alert", "discover"].some((value) => normalized.includes(value))) return "Printers";
  return "PrintOps";
}

export function PageHeader({
  title,
  actions,
  parentTitle,
  hideTitle = false,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  parentTitle?: string;
  hideTitle?: boolean;
}) {
  const sectionTitle = parentTitle || pageHeaderSection(title);
  const showPageTitle = !hideTitle && sectionTitle.trim().toLowerCase() !== title.trim().toLowerCase();

  return (
    <PageHeaderPortal>
      <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 sm:text-[11px]">
              {sectionTitle}
            </span>
            {showPageTitle && (
              <>
                <span className="shrink-0 text-slate-400" aria-hidden="true">
                  <IconGlyph icon={ChevronRight} size={13} />
                </span>
                <h1 className="truncate text-sm font-medium tracking-[-0.01em] text-slate-800 sm:text-[15px]">
                  {title}
                </h1>
              </>
            )}
            {!showPageTitle && <h1 className="sr-only">{title}</h1>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </PageHeaderPortal>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`app-card rounded-lg border border-[#dfe6ee] bg-white ${className}`}>
      {children}
    </div>
  );
}

export function TableCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`table-card h-[32rem] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 ${className}`}>
      {children}
    </Card>
  );
}

export function StatCard({
  label,
  value,
  accent = "#014171",
  icon,
  compact = false,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  icon?: IconNode;
  compact?: boolean;
}) {
  const style = { "--metric-accent": accent } as CSSProperties;

  return (
    <Card
      className={`h-full min-w-0 ${compact ? "p-4" : "p-5"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.075em] text-slate-500">{label}</p>
          <p
            className={`${compact ? "mt-2 text-2xl" : "mt-3 text-[2rem]"} font-bold leading-none tracking-[-0.035em] text-slate-900`}
          >
            {value}
          </p>
        </div>
        {icon && (
          <span
            className="flex shrink-0 items-center justify-center opacity-70"
            style={{ color: accent }}
          >
            <IconGlyph icon={icon} size={compact ? 16 : 19} />
          </span>
        )}
      </div>
    </Card>
  );
}

export function IconGlyph({
  icon,
  size = 18,
}: {
  icon: IconNode;
  size?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon.map(([tag, attributes], index) =>
        createElement(tag, { ...attributes, key: `${tag}-${index}` }),
      )}
    </svg>
  );
}

export function Badge({
  children,
  color,
}: {
  children: ReactNode;
  color: "green" | "yellow" | "red" | "blue" | "gray" | "orange";
}) {
  const colors: Record<string, string> = {
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    yellow: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    gray: "border-slate-200 bg-slate-50 text-slate-600",
    orange: "border-orange-200 bg-orange-50 text-orange-700",
  };
  return <span className={`badge ${colors[color]}`}>{children}</span>;
}

export function statusBadgeColor(status: string): "green" | "yellow" | "red" | "blue" | "gray" | "orange" {
  const s = status.toLowerCase();
  if (["active", "operational", "open", "completed", "delivery"].includes(s)) return "green";
  if (["under repair", "in progress", "request", "pending"].includes(s)) return "yellow";
  if (["closed", "resolved"].includes(s)) return "blue";
  if (["disposed", "lost"].includes(s)) return "red";
  if (["spare", "for replacement"].includes(s)) return "blue";
  if (["pull out"].includes(s)) return "orange";
  return "gray";
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  error?: string;
  required?: boolean;
  floatingLabel?: boolean;
}) {
  const { label, error, required, className, floatingLabel = false, ...rest } = props;
  const inputId = rest.id ?? (typeof rest.name === "string" ? `field-${rest.name}` : undefined);

  if (floatingLabel && label) {
    return (
      <div>
        <div className="add-printer-floating-field">
          <input
            {...rest}
            id={inputId}
            required={required}
            placeholder=" "
            className={`h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 pb-1 pt-4 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#040273] focus:ring-2 focus:ring-[#040273]/15 disabled:bg-slate-100 disabled:text-slate-500 ${className || ""}`}
          />
          <label htmlFor={inputId}>
            {label} {required && <span className="text-red-500">*</span>}
          </label>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        {...rest}
        required={required}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:bg-slate-100 disabled:text-slate-500 ${className || ""}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function Textarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; error?: string; required?: boolean },
) {
  const { label, error, required, className, ...rest } = props;
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        {...rest}
        required={required}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:bg-slate-100 disabled:text-slate-500 ${className || ""}`}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function PrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { className, children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#012c50] hover:shadow-md active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${className || ""}`}
    >
      {children}
    </button>
  );
}

export function SecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { className, children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${className || ""}`}
    >
      {children}
    </button>
  );
}

export function DangerButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement>,
) {
  const { className, children, ...rest } = props;
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60 ${className || ""}`}
    >
      {children}
    </button>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-slate-500">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-slate-400 shadow-sm">
        <IconGlyph icon={Inbox} size={21} />
      </span>
      <p className="max-w-md text-sm leading-6">{message}</p>
    </div>
  );
}
