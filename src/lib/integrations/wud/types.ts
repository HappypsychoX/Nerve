import type { ContainerUpdate, IntegrationHealth } from "@/types";

export type WudErrorKind = "timeout" | "network" | "http" | "auth" | "unconfigured";

export type WudResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WudErrorKind };

export interface WudContainer {
  id: string;
  name?: string;
  displayName?: string;
  image?: { tag?: { value?: string } };
  result?: { tag?: string; created?: string };
  updateAvailable?: boolean;
  updateKind?: { localValue?: string; remoteValue?: string };
  update?: { localValue?: string; remoteValue?: string };
  error?: { message?: string } | null;
}

export interface WudUpdatesData {
  updates: ContainerUpdate[];
  fetchedAt: string;
}

export interface WudUpdatesResponse {
  health: IntegrationHealth;
  detail: string;
  updates: ContainerUpdate[];
  count: number;
  total: number;
  fetchedAt: string | null;
  wudUrl: string | null;
}
