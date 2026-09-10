import { Badge } from "@/components/ui";

export type MonitoringBadgeColor = "green" | "yellow" | "red" | "blue" | "gray" | "orange";

export default function LiveMonitoringBadge({
  label,
  color,
}: {
  label: string;
  color: MonitoringBadgeColor;
}) {
  const animation = monitoringAnimation(label, color);

  return (
    <Badge color={color}>
      <StatusIndicator animation={animation} color={color} />
      {label}
    </Badge>
  );
}

function StatusIndicator({
  animation,
  color,
}: {
  animation: "heartbeat" | "activity" | "warning" | "stale" | "static";
  color: MonitoringBadgeColor;
}) {
  const dotColor = {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-sky-500",
    gray: "bg-slate-400",
    orange: "bg-orange-500",
  }[color];

  if (animation === "activity") {
    return (
      <span className="flex h-2.5 w-3 items-end justify-between" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className={`monitoring-activity-bar h-full w-0.5 origin-bottom rounded-full ${dotColor}`}
            style={{ animationDelay: `${index * 140}ms` }}
          />
        ))}
      </span>
    );
  }

  if (animation === "heartbeat") {
    return (
      <span className="relative flex size-3 items-center justify-center" aria-hidden="true">
        <span className={`monitoring-heartbeat-ring absolute inset-0 rounded-full border ${indicatorBorderColor(color)}`} />
        <span className={`monitoring-heartbeat-core relative size-2 rounded-full ${dotColor}`} />
      </span>
    );
  }

  return (
    <span className="relative flex size-2.5 items-center justify-center" aria-hidden="true">
      {(animation === "warning" || animation === "stale") && (
        <span className={`absolute inset-0 rounded-full ${dotColor} ${
          animation === "warning" ? "monitoring-warning-pulse" : "monitoring-stale-pulse"
        }`} />
      )}
      <span className={`relative size-2 rounded-full ${dotColor}`} />
    </span>
  );
}

function indicatorBorderColor(color: MonitoringBadgeColor) {
  return {
    green: "border-emerald-500",
    yellow: "border-amber-500",
    red: "border-red-500",
    blue: "border-sky-500",
    gray: "border-slate-400",
    orange: "border-orange-500",
  }[color];
}

function monitoringAnimation(
  label: string,
  color: MonitoringBadgeColor,
): "heartbeat" | "activity" | "warning" | "stale" | "static" {
  const normalized = label.toLowerCase();
  if (normalized.includes("print") || normalized.includes("process")) return "activity";
  if (["warning", "error", "fault", "jam"].some((status) => normalized.includes(status))) return "warning";
  if (normalized.includes("stale")) return "stale";
  if (["idle", "ready", "online", "normal", "standby", "sleep"].some((status) => normalized.includes(status))) {
    return "heartbeat";
  }
  if (color === "green") return "heartbeat";
  if (color === "yellow") return "warning";
  if (color === "orange") return "stale";
  return "static";
}
