import type { BackupRun, IntegrationHealth } from "@/types";

export interface OffenStorageStats {
  Total?: number;
  Pruned?: number;
  PruneErrors?: number;
}

export interface OffenStats {
  StartTime?: string;
  EndTime?: string;
  TookTime?: number;
  LockedTime?: number;
  LogOutput?: string;
  Containers?: {
    All?: number;
    ToStop?: number;
    Stopped?: number;
    StopErrors?: number;
  };
  BackupFile?: {
    Name?: string;
    FullPath?: string;
    Size?: number;
  };
  Storages?: Record<string, OffenStorageStats>;
}

export interface OffenNotification {
  status?: string;
  stats?: OffenStats;
  error?: unknown;
}

export interface BackupsResponse {
  latest: BackupRun | null;
  runs: BackupRun[];
  containerStatus: { running: boolean; names: string[] };
  health: IntegrationHealth;
  detail: string;
  dbError: string | null;
}
