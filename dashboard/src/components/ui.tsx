import { createElement, type CSSProperties, type ReactNode } from "react";
import { Inbox, type IconNode } from "lucide";
import { PageHeaderPortal } from "@/components/PageHeaderPortal";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <PageHeaderPortal>
      <div className="flex flex-col justify-between gap-2.5 sm:flex-row sm:items-center sm:gap-5">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-[-0.02em] text-[#014171] sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-[13px]">{subtitle}</p>}
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
    <div className={`app-card rounded-2xl border border-[#dfe6ee] bg-white ${className}`}>
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
      className={`relative h-full min-w-0 overflow-hidden ${compact ? "p-4" : "p-5"}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-0.5 bg-[var(--metric-accent)]"
        style={style}
      />
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
            className={`${compact ? "size-8 rounded-lg" : "size-10 rounded-xl"} flex shrink-0 items-center justify-center`}
            style={{ backgroundColor: `${accent}14`, color: accent }}
          >
            <IconGlyph icon={icon} size={compact ? 16 : 19} />
          </span>
        )}
      </div>
      <span
        aria-hidden="true"
        className="absolute bottom-0 right-0 size-20 translate-x-8 translate-y-8 rounded-full opacity-[0.06]"
        style={{ backgroundColor: accent }}
      />
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

export function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string; required?: boolean }) {
  const { label, error, required, className, ...rest } = props;
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

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; required?: boolean },
) {
  const { label, error, required, className, children, ...rest } = props;
  return (
    <div>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <select
        {...rest}
        required={required}
        className={`w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none transition hover:border-slate-400 focus:border-[#014171] focus:ring-2 focus:ring-[#014171]/15 disabled:bg-slate-100 disabled:text-slate-500 ${className || ""}`}
      >
        {children}
      </select>
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
