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
  const showSectionTitle = sectionTitle.trim().toLowerCase() !== title.trim().toLowerCase();
  const showPageTitle = !hideTitle;

  return (
    <PageHeaderPortal>
      <div className="flex min-w-0 flex-col justify-between gap-2.5 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2.5">
            {showSectionTitle && <span className="h-5 w-px shrink-0 bg-app-border max-[479px]:hidden" aria-hidden="true" />}
            {showSectionTitle && <span className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-app-muted max-[479px]:hidden">
              {sectionTitle}
            </span>}
            {showPageTitle && (
              <>
                {showSectionTitle && <span className="shrink-0 text-app-muted max-[479px]:hidden" aria-hidden="true">
                  <IconGlyph icon={ChevronRight} size={13} />
                </span>}
                <h1 className="truncate text-lg font-semibold tracking-[-0.015em] text-app-ink sm:text-xl">
                  {title}
                </h1>
              </>
            )}
            {!showPageTitle && <h1 className="truncate text-lg font-semibold tracking-[-0.015em] text-app-ink sm:sr-only">{title}</h1>}
          </div>
        </div>
        {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 max-[479px]:justify-start sm:w-auto sm:shrink-0 sm:flex-nowrap">{actions}</div>}
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
    <div className={`app-card rounded-lg border border-app-border bg-app-surface ${className}`}>
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
    <Card className={`table-card overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 ${className}`}>
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
          <p className="text-[11px] font-bold uppercase leading-4 tracking-[0.075em] text-app-muted">{label}</p>
          <p
            className={`${compact ? "mt-2 text-2xl" : "mt-3 text-[2rem]"} font-bold leading-none tracking-[-0.035em] text-app-ink`}
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
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-300",
    yellow: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/15 dark:text-amber-300",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/15 dark:text-red-300",
    blue: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-300",
    gray: "border-app-border bg-app-surface-subtle text-app-muted",
    orange: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-400/30 dark:bg-orange-400/15 dark:text-orange-300",
  };
  return <span className={`badge ${colors[color]}`}>{children}</span>;
}

export function statusBadgeColor(status: string): "green" | "yellow" | "red" | "blue" | "gray" | "orange" {
  const s = status.toLowerCase();
  if (["active", "operational", "open", "completed", "delivery", "delivered"].includes(s)) return "green";
  if (["under repair", "in progress", "request", "purchase", "pending"].includes(s)) return "yellow";
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
            className={`h-12 w-full rounded-xl border border-app-border-strong bg-app-surface px-3.5 pb-1 pt-4 text-sm text-app-ink-soft shadow-sm outline-none transition hover:border-app-muted focus:border-app-focus focus:ring-2 focus:ring-app-focus/20 disabled:bg-app-surface-subtle disabled:text-app-muted ${className || ""}`}
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
        <label className="mb-1.5 block text-sm font-medium text-app-ink-soft">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <input
        {...rest}
        required={required}
        className={`w-full rounded-xl border border-app-border-strong bg-app-surface px-3.5 py-2.5 text-sm text-app-ink-soft shadow-sm outline-none transition hover:border-app-muted focus:border-app-focus focus:ring-2 focus:ring-app-focus/20 disabled:bg-app-surface-subtle disabled:text-app-muted ${className || ""}`}
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
        <label className="mb-1.5 block text-sm font-medium text-app-ink-soft">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <textarea
        {...rest}
        required={required}
        className={`w-full rounded-xl border border-app-border-strong bg-app-surface px-3.5 py-2.5 text-sm text-app-ink-soft shadow-sm outline-none transition hover:border-app-muted focus:border-app-focus focus:ring-2 focus:ring-app-focus/20 disabled:bg-app-surface-subtle disabled:text-app-muted ${className || ""}`}
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
      className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-app-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-app-primary-hover hover:shadow-md active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${className || ""}`}
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
      className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-app-border-strong bg-app-surface px-4 py-2.5 text-sm font-semibold text-app-ink-soft shadow-sm transition hover:border-app-muted hover:bg-app-surface-raised active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60 ${className || ""}`}
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

export function EmptyState({ message, action }: { message: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[15rem] flex-col items-center justify-center gap-3 px-6 py-8 text-center text-app-muted">
      <span className="flex size-12 items-center justify-center rounded-2xl border border-app-border bg-app-surface-subtle text-app-muted shadow-sm">
        <IconGlyph icon={Inbox} size={21} />
      </span>
      <p className="max-w-md text-sm leading-6">{message}</p>
      {action}
    </div>
  );
}
