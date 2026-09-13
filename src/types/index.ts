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

export type VpnState = "running" | "stopped" | "unknown";

export interface VpnStatus {
  state: VpnState;
  publicIp: string | null;
  containerHealthy: boolean | null;
  containerState: ContainerState | null;
  containerHealth: ContainerHealth | null;
}

export type ServiceHealth = "online" | "degraded" | "offline" | "unknown";

// Per-container derived DISPLAY status. Structurally identical to
// IntegrationHealth (same 4 literals) but semantically distinct: a stopped
// container maps to "offline" here WITHOUT implying the Docker engine is down.
export type ContainerDisplayStatus = "healthy" | "degraded" | "offline" | "unknown";

export interface DockerContainerCounts {
  running: number;
  stopped: number;
  unhealthy: number;
}

export interface DockerAggregate {
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
}

export interface DockerSummary {
  cpuPercent: number | null;
  memoryUsedBytes: number | null;
  memoryTotalBytes: number | null;
  diskUsedBytes: number | null;
  diskReclaimableBytes: number | null;
  running: number;
  stopped: number;
  unhealthy: number;
  images: number | null;
  version: string | null;
}

export interface SystemStatusRow {
  id: string;
  label: string;
  health: IntegrationHealth;
  detail: string;
}

export interface AttentionItem {
  id: string;
  label: string;
  detail: string;
}

export interface ContainerUpdate {
  containerId: string;
  containerName: string;
  currentVersion: string | null;
  availableVersion: string | null;
  updateAvailable: boolean;
}

export type BackupSource = "local" | "cloudflare";
export type BackupStatus = "success" | "failure";
export type BackupStorageStatus = "success" | "failure" | "skipped" | null;
export interface BackupRun {
  id: number;
  status: BackupStatus;
  source: BackupSource | null;
  startedAt: number;   // epoch ms
  endedAt: number | null; // epoch ms
  durationSeconds: number | null;
  filename: string | null;
  sizeBytes: number | null;
  stoppedContainers: number;
  stopErrors: number;
  localStatus: BackupStorageStatus;
  s3Status: BackupStorageStatus;
  error: string | null;
  receivedAt: number;  // epoch ms
}
