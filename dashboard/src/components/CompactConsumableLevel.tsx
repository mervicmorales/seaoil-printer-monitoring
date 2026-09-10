export type CompactConsumable = {
  name: string;
  type: string;
  levelPercent: number | null;
  status: string | null;
  isUnknown: boolean;
};

export default function CompactConsumableLevel({
  consumable,
  displayName,
}: {
  consumable: CompactConsumable;
  displayName?: string;
}) {
  const hasLevel = !consumable.isUnknown && consumable.levelPercent !== null;
  const level = hasLevel ? Math.max(0, Math.min(100, consumable.levelPercent!)) : null;
  const low = level !== null && level <= 20;

  return (
    <div className={`min-w-0 rounded-xl border p-3 ${low ? "border-orange-200 bg-orange-50/60" : "border-slate-200 bg-slate-50/60"}`}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-slate-700" title={consumable.name}>
            {displayName || consumable.name}
          </p>
          <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {formatConsumableType(consumable.type)}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-bold ${low ? "text-orange-700" : "text-slate-700"}`}>
          {level !== null ? `${level}%` : consumable.status || "Unknown"}
        </span>
      </div>
      {level !== null && (
        <div
          className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-label={`${displayName || consumable.name} level`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={level}
        >
          <span
            className={`block h-full rounded-full ${consumableBarColor(consumable, low)}`}
            style={{ width: `${level}%` }}
          />
        </div>
      )}
    </div>
  );
}

function formatConsumableType(type: string) {
  return type.replace(/[_-]+/g, " ");
}

function consumableBarColor(consumable: CompactConsumable, low: boolean) {
  if (low) return "bg-orange-500";
  const name = `${consumable.name} ${consumable.type}`.toLowerCase();
  if (name.includes("cyan")) return "bg-cyan-500";
  if (name.includes("magenta")) return "bg-fuchsia-500";
  if (name.includes("yellow")) return "bg-yellow-400";
  if (name.includes("black")) return "bg-slate-700";
  return "bg-sky-600";
}
