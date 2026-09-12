import type { ServiceGroup } from "@/lib/config";
import type {
  ContainerStatus,
  DockerAggregate,
  DockerContainerCounts,
  IntegrationHealth,
} from "@/types";

export type DockerErrorKind = "timeout" | "network" | "http";

export type DockerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: DockerErrorKind };

// --- raw Docker Engine shapes (subset used) ---
export interface DockerContainerSummary {
  Id: string;
  Names: string[];
  Image: string;
  ImageID?: string;
  State: string;
  Status: string;
}
export interface DockerContainerInspect {
  State: {
    Status: string;
    StartedAt: string;
    Health?: { Status: string };
  };
  RestartCount: number;
}
export interface DockerStats {
  read: string;
  cpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
    online_cpus?: number;
  };
  precpu_stats: {
    cpu_usage: { total_usage: number };
    system_cpu_usage: number;
  };
  memory_stats?: { usage: number };
}
export interface DockerInfo {
  MemTotal: number;
}
export interface DockerVersion {
  Version: string;
}

// --- API DTOs (route response shapes; shared with client hooks) ---
export interface ContainerRow extends ContainerStatus {
  group: ServiceGroup;
}

export interface DockerHealthResponse {
  health: IntegrationHealth;
  version: string | null;
}

export interface DockerContainersResponse {
  health: IntegrationHealth;
  containers: ContainerRow[];
  counts: DockerContainerCounts;
  aggregate: DockerAggregate;
}

export interface DockerSystemResponse {
  health: IntegrationHealth;
  version: string | null;
  images: number | null;
  memoryTotalBytes: number | null;
  diskUsedBytes: number | null;
  diskReclaimableBytes: number | null;
}

export interface DockerSystemData {
  version: string | null;
  images: number | null;
  memoryTotalBytes: number | null;
  diskUsedBytes: number | null;
  diskReclaimableBytes: number | null;
  versionReachable: boolean;
}
