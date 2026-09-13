import { getContainers } from "@/lib/integrations/docker";
import type { DockerResult } from "@/lib/integrations/docker/types";
import type { ContainerStatus, VpnState, VpnStatus } from "@/types";
import {
  fetchGluetunPublicIp,
  fetchGluetunVpnStatus,
  gluetunApiKey,
  gluetunBaseUrl,
} from "./client";
import type { GluetunFetchResult } from "./client";
import { parsePublicIp, parseVpnState } from "./normalize";
import type {
  GluetunContainerInfo,
  GluetunErrorKind,
  GluetunResult,
  VpnStatusResponse,
} from "./types";

export const GLUETUN_CONTAINER_NAME =
  process.env.GLUETUN_CONTAINER_NAME?.trim() || "gluetun";

const GLUETUN_ERROR_DETAIL: Record<GluetunErrorKind, string> = {
  unconfigured: "Not configured",
  timeout: "Timed out",
  network: "Unreachable",
  http: "Error",
  auth: "Auth failed",
  parse: "Unexpected response",
};

function containerHealthyFromRow(row: ContainerStatus): boolean | null {
  if (row.state === "running") return row.health === "unhealthy" ? false : true;
  if (row.state === "stopped" || row.state === "restarting") return false;
  return null;
}

function toContainerInfo(
  result: DockerResult<ContainerStatus[]> | { ok: false; error: string },
): GluetunContainerInfo {
  if (!result.ok) {
    return { containerHealthy: null, containerState: null, containerHealth: null };
  }
  const row = result.data.find((c) => c.name === GLUETUN_CONTAINER_NAME);
  if (!row) {
    return { containerHealthy: null, containerState: null, containerHealth: null };
  }
  return {
    containerHealthy: containerHealthyFromRow(row),
    containerState: row.state,
    containerHealth: row.health,
  };
}

export async function getVpnStatus(): Promise<GluetunResult> {
  if (!gluetunBaseUrl() || !gluetunApiKey()) {
    const container = toContainerInfo(
      await getContainers().catch(
        (): DockerResult<ContainerStatus[]> => ({ ok: false, error: "network" }),
      ),
    );
    return { ok: false, error: "unconfigured", container };
  }

  const [statusRes, ipRes, containersRes] = await Promise.allSettled([
    fetchGluetunVpnStatus(),
    fetchGluetunPublicIp(),
    getContainers(),
  ]);

  const container = toContainerInfo(
    containersRes.status === "fulfilled"
      ? containersRes.value
      : { ok: false, error: "network" },
  );

  const status: GluetunFetchResult | null =
    statusRes.status === "fulfilled" ? statusRes.value : null;

  if (!status || !status.ok) {
    return { ok: false, error: status ? status.error : "network", container };
  }

  const state = parseVpnState(status.data);
  if (state === "unknown") {
    return { ok: false, error: "parse", container };
  }

  const publicIp =
    ipRes.status === "fulfilled" && ipRes.value.ok
      ? parsePublicIp(ipRes.value.data)
      : null;

  return {
    ok: true,
    data: { state, publicIp, fetchedAt: new Date().toISOString() },
    container,
  };
}

function toVpnStatus(
  state: VpnState,
  publicIp: string | null,
  container: GluetunContainerInfo,
): VpnStatus {
  return {
    state,
    publicIp,
    containerHealthy: container.containerHealthy,
    containerState: container.containerState,
    containerHealth: container.containerHealth,
  };
}

export function buildVpnStatusResponse(result: GluetunResult): VpnStatusResponse {
  if (!result.ok) {
    return {
      health: "unknown",
      detail: GLUETUN_ERROR_DETAIL[result.error],
      status: toVpnStatus("unknown", null, result.container),
      fetchedAt: null,
    };
  }

  const { state, publicIp, fetchedAt } = result.data;

  if (state === "running") {
    return {
      health: "healthy",
      detail: "Connected",
      status: toVpnStatus(state, publicIp, result.container),
      fetchedAt,
    };
  }

  return {
    health: "degraded",
    detail: "VPN stopped",
    status: toVpnStatus(state, publicIp, result.container),
    fetchedAt,
  };
}
