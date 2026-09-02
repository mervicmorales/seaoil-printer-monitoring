import { ReactNode } from "react";
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
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold text-[#014171] sm:text-2xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-500 sm:text-sm">{subtitle}</p>}
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
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>
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
    <Card className={`h-[32rem] overflow-auto [&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 ${className}`}>
      {children}
    </Card>
  );
}

export function StatCard({
  label,
  value,
  accent = "#014171",
  icon,
}: {
  label: string;
  value: ReactNode;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {icon && (
          <span
            className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
            style={{ backgroundColor: `${accent}1a`, color: accent }}
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-3 text-3xl font-bold" style={{ color: accent }}>
        {value}
      </p>
    </Card>
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
    green: "bg-emerald-100 text-emerald-700",
    yellow: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-sky-100 text-sky-700",
    gray: "bg-slate-100 text-slate-600",
    orange: "bg-orange-100 text-orange-700",
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
        className={`w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40 ${className || ""}`}
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
        className={`w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40 ${className || ""}`}
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
        className={`w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-[#014171] focus:ring-2 focus:ring-[#7DA8D0]/40 ${className || ""}`}
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
      className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#014171] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#012c50] disabled:cursor-not-allowed disabled:opacity-60 ${className || ""}`}
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
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${className || ""}`}
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
    <div className="flex flex-col items-center justify-center gap-2 py-14 text-center text-slate-500">
      <span className="text-3xl">🗂️</span>
      <p className="text-sm">{message}</p>
    </div>
  );
}
