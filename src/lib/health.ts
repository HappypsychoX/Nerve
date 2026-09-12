import type {
  ContainerHealth,
  ContainerState,
  IntegrationHealth,
} from "@/types";

export const HEALTH_TEXT: Record<IntegrationHealth, string> = {
  healthy: "Healthy",
  degraded: "Degraded",
  offline: "Offline",
  unknown: "Unknown",
};

export const HEALTH_TEXT_COLOR: Record<IntegrationHealth, string> = {
  healthy: "text-healthy",
  degraded: "text-degraded",
  offline: "text-offline",
  unknown: "text-unknown",
};

export const HEALTH_DOT_COLOR: Record<IntegrationHealth, string> = {
  healthy: "bg-healthy",
  degraded: "bg-degraded",
  offline: "bg-offline",
  unknown: "bg-unknown",
};

export const HEALTH_BORDER_COLOR: Record<IntegrationHealth, string> = {
  healthy: "border-healthy/40",
  degraded: "border-degraded/40",
  offline: "border-offline/40",
  unknown: "border-unknown/40",
};

export function containerOverallHealth(
  state: ContainerState,
  health: ContainerHealth,
): IntegrationHealth {
  if (state === "stopped") return "offline";
  if (state === "restarting" || health === "unhealthy") return "degraded";
  if (state === "running") return "healthy";
  return "unknown";
}

export function containerStateLabel(
  state: ContainerState,
  health: ContainerHealth,
): string {
  if (health === "healthy") return "healthy";
  if (health === "unhealthy") return "unhealthy";
  if (health === "starting") return "starting";
  if (state === "restarting") return "restarting";
  if (state === "stopped") return "stopped";
  if (state === "running") return "running";
  return "unknown";
}
