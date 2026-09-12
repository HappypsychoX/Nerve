export type IntegrationHealth = "healthy" | "degraded" | "offline" | "unknown";

export type ContainerState = "running" | "stopped" | "restarting" | "unknown";

export type ContainerHealth = "healthy" | "unhealthy" | "starting" | "none";

export interface ContainerStatus {
  id: string;
  name: string;
  image: string;
  state: ContainerState;
  health: ContainerHealth;
  uptimeSeconds: number | null;
  restartCount: number;
  cpuPercent: number | null;
  memoryBytes: number | null;
}

export type ServiceHealth = "online" | "degraded" | "offline" | "unknown";
