import type {
  ContainerHealth,
  ContainerState,
  IntegrationHealth,
  VpnState,
  VpnStatus,
} from "@/types";

export type GluetunErrorKind =
  | "timeout"
  | "network"
  | "http"
  | "auth"
  | "unconfigured"
  | "parse";

export interface GluetunVpnStatusPayload {
  status?: string;
}
export interface GluetunPublicIpPayload {
  public_ip?: string;
  ip?: string;
}

export interface GluetunContainerInfo {
  containerHealthy: boolean | null;
  containerState: ContainerState | null;
  containerHealth: ContainerHealth | null;
}

export interface VpnStatusData {
  state: VpnState;
  publicIp: string | null;
  fetchedAt: string;
}

export type GluetunResult =
  | { ok: true; data: VpnStatusData; container: GluetunContainerInfo }
  | { ok: false; error: GluetunErrorKind; container: GluetunContainerInfo };

export interface VpnStatusResponse {
  health: IntegrationHealth;
  detail: string;
  status: VpnStatus;
  fetchedAt: string | null;
}
