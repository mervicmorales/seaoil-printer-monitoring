import type { ReactNode } from "react";

export default function RecordTableToolbar({
  count,
  label,
  children,
}: {
  count: number;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col gap-2.5 border-b border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex h-10 shrink-0 items-center px-1 text-xs font-semibold text-slate-500">
        <span className="size-2 rounded-full bg-emerald-500" aria-hidden="true" />
        <span className="ml-2 whitespace-nowrap">
          {count} {label}{count === 1 ? "" : "s"}
        </span>
      </div>
      {children && <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end [&>form]:w-full sm:[&>form]:w-auto">{children}</div>}
    </div>
  );
}
