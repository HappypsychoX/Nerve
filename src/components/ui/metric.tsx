import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Metric({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-[11px] uppercase tracking-[0.12em] text-faint">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm text-fg">{value}</div>
      {sub ? <div className="mt-0.5 text-2xs text-faint">{sub}</div> : null}
    </div>
  );
}

export function ProgressBar({
  percent,
  tone = "accent",
}: {
  percent: number;
  tone?: "accent" | "healthy" | "degraded" | "offline";
}) {
  const toneClass = {
    accent: "bg-accent",
    healthy: "bg-healthy",
    degraded: "bg-degraded",
    offline: "bg-offline",
  }[tone];

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className={cn("h-full rounded-full", toneClass)}
        style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      />
    </div>
  );
}
