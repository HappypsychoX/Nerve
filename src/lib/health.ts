import type {
  ContainerDisplayStatus,
  ContainerHealth,
  ContainerState,
  IntegrationHealth,
  ServiceHealth,
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

export function containerDisplayStatus(
  state: ContainerState,
  health: ContainerHealth,
): ContainerDisplayStatus {
  if (state === "running" && (health === "none" || health === "healthy")) return "healthy";
  if (state === "running" && (health === "starting" || health === "unhealthy")) return "degraded";
  if (state === "restarting") return "degraded";
  if (state === "stopped") return "offline";
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

export const SERVICE_HEALTH_TEXT: Record<ServiceHealth, string> = {
  online: "Online",
  degraded: "Degraded",
  offline: "Offline",
  unknown: "Unknown",
};

export function serviceHealthToIntegration(
  health: ServiceHealth,
): IntegrationHealth {
  return health === "online" ? "healthy" : health;
}

export function computeOverallHealth(
  docker: IntegrationHealth,
  criticalServices: ServiceHealth[],
): IntegrationHealth {
  if (docker === "offline") return "offline";
  if (docker === "unknown") return "unknown";
  const base = docker === "degraded" ? "degraded" : "healthy";
  if (criticalServices.some((s) => s === "offline" || s === "degraded")) {
    return "degraded";
  }
  return base;
}

export function summarizeServices(
  rows: readonly { health: ServiceHealth }[],
): { health: IntegrationHealth; detail: string } {
  if (rows.length === 0) {
    return { health: "unknown", detail: "No services configured" };
  }
  const checked = rows.filter((r) => r.health !== "unknown");
  if (checked.length === 0) {
    return { health: "unknown", detail: "Not checked" };
  }
  const online = checked.filter((r) => r.health === "online").length;
  if (online === checked.length) {
    return { health: "healthy", detail: `${online}/${checked.length} online` };
  }
  if (online === 0) {
    return { health: "offline", detail: `0/${checked.length} online` };
  }
  return { health: "degraded", detail: `${online}/${checked.length} online` };
}
