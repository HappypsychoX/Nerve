import type { IntegrationHealth } from "@/types";
import {
  HEALTH_DOT_COLOR,
  HEALTH_TEXT,
  HEALTH_TEXT_COLOR,
} from "@/lib/health";
import { cn } from "@/lib/utils";

export function StatusDot({
  health,
  pulse = false,
  label,
  className,
}: {
  health: IntegrationHealth;
  pulse?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      title={label}
      className={cn(
        "inline-block h-2 w-2 shrink-0 rounded-full",
        HEALTH_DOT_COLOR[health],
        pulse &&
          (health === "degraded" || health === "offline") &&
          "animate-pulse-soft",
        className,
      )}
    />
  );
}

export function StatusPill({
  health,
  label,
  className,
}: {
  health: IntegrationHealth;
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5", className)}
      data-health={health}
      title={HEALTH_TEXT[health]}
    >
      <StatusDot
        health={health}
        label={HEALTH_TEXT[health]}
        pulse={health === "degraded" || health === "offline"}
      />
      <span
        className={cn("text-xs font-medium", HEALTH_TEXT_COLOR[health])}
      >
        {label ?? HEALTH_TEXT[health]}
      </span>
    </span>
  );
}
