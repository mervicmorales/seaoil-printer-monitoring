export default function RecordTableSkeleton({ title }: { title: string }) {
  return (
    <div role="status" aria-label={`Loading ${title}`} className="flex h-[calc(100dvh-111px)] min-h-0 flex-col">
      <span className="sr-only">Loading {title}…</span>
      <div className="flex min-h-12 items-center text-sm font-semibold text-slate-500">{title}</div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white animate-pulse">
        <div className="flex h-16 items-center justify-between gap-4 border-b border-slate-200 px-5">
          <div className="h-4 w-28 rounded bg-slate-200" />
          <div className="h-9 w-48 rounded bg-slate-100" />
        </div>
        <div className="h-11 border-b border-slate-200 bg-slate-50" />
        <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-hidden">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex h-16 items-center gap-6 px-5">
              <div className="h-4 w-1/4 rounded bg-slate-200" />
              <div className="h-4 w-1/3 rounded bg-slate-100" />
              <div className="h-4 w-1/5 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
