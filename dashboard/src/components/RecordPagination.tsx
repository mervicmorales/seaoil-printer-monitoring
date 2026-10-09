import Link from "next/link";

type SearchParams = Record<string, string | string[] | undefined>;

export function paginateRecords<T>(rows: T[], requestedPage: string, pageSize = 50) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const parsed = Number(requestedPage);
  const page = Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, totalPages)
    : 1;
  const start = (page - 1) * pageSize;
  return { page, totalPages, start, items: rows.slice(start, start + pageSize) };
}

export default function RecordPagination({
  pathname,
  searchParams,
  page,
  totalPages,
  total,
  start,
  pageSize = 50,
}: {
  pathname: string;
  searchParams: SearchParams;
  page: number;
  totalPages: number;
  total: number;
  start: number;
  pageSize?: number;
}) {
  function href(target: number) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key === "page" || value === undefined) continue;
      for (const part of Array.isArray(value) ? value : [value]) params.append(key, part);
    }
    if (target > 1) params.set("page", String(target));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  return (
    <nav aria-label="Table pages" className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600">
      <span>{total === 0 ? "No records to show" : `Showing ${start + 1}–${Math.min(start + pageSize, total)} of ${total}`}</span>
      {totalPages > 1 ? (
        <div className="flex items-center gap-2">
          {page > 1 ? <Link href={href(page - 1)} scroll={false} className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50">Previous</Link> : <span className="rounded-md border border-slate-100 px-3 py-1.5 text-slate-400">Previous</span>}
          <span className="min-w-16 text-center font-semibold text-slate-700">{page} / {totalPages}</span>
          {page < totalPages ? <Link href={href(page + 1)} scroll={false} className="rounded-md border border-slate-200 px-3 py-1.5 font-semibold hover:bg-slate-50">Next</Link> : <span className="rounded-md border border-slate-100 px-3 py-1.5 text-slate-400">Next</span>}
        </div>
      ) : (
        <span className="font-medium text-slate-400">All records visible</span>
      )}
    </nav>
  );
}
