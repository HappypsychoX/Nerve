"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePolled, type PolledResult } from "@/hooks/use-polled";
import { BACKUP_POLL_INTERVAL_MS } from "@/hooks/use-backups";
import { VPN_POLL_INTERVAL_MS } from "@/hooks/use-vpn";
import { UPDATES_POLL_INTERVAL_MS } from "@/hooks/use-updates";
import type { DockerHealthResponse } from "@/lib/integrations/docker/types";
import type { DockerContainersResponse } from "@/lib/integrations/docker/types";
import type { DockerSystemResponse } from "@/lib/integrations/docker/types";
import type { ServiceRow } from "@/lib/integrations/services/types";
import type { BackupsResponse } from "@/lib/integrations/backup/types";
import type { VpnStatusResponse } from "@/lib/integrations/gluetun/types";
import type { WudUpdatesResponse } from "@/lib/integrations/wud/types";

const DOCKER_HEALTH_INTERVAL_MS = 5000;
const DOCKER_CONTAINERS_INTERVAL_MS = 5000;
const DOCKER_SYSTEM_INTERVAL_MS = 300000;
const SERVICES_INTERVAL_MS = 30000;

const INITIAL_DOCKER_HEALTH: DockerHealthResponse = {
  health: "unknown",
  version: null,
};

const INITIAL_CONTAINERS: DockerContainersResponse = {
  health: "unknown",
  containers: [],
  counts: { running: 0, stopped: 0, unhealthy: 0 },
  aggregate: { cpuPercent: null, memoryUsedBytes: null },
  criticalCounts: { stopped: 0, unhealthy: 0, restarting: 0 },
};

const INITIAL_SYSTEM: DockerSystemResponse = {
  health: "unknown",
  version: null,
  images: null,
  memoryTotalBytes: null,
  diskUsedBytes: null,
  diskReclaimableBytes: null,
};

const INITIAL_SERVICES: { services: ServiceRow[] } = { services: [] };

const INITIAL_BACKUPS: BackupsResponse = {
  latest: null,
  runs: [],
  containerStatus: { running: false, names: [] },
  health: "unknown",
  detail: "Checking…",
  dbError: null,
};

const INITIAL_VPN: VpnStatusResponse = {
  health: "unknown",
  detail: "Checking…",
  status: {
    state: "unknown",
    publicIp: null,
    containerHealthy: null,
    containerState: null,
    containerHealth: null,
  },
  fetchedAt: null,
};

const INITIAL_UPDATES: WudUpdatesResponse = {
  health: "unknown",
  detail: "Checking…",
  updates: [],
  count: 0,
  total: 0,
  fetchedAt: null,
  wudUrl: null,
};

interface DashboardContextValue {
  dockerHealth: PolledResult<DockerHealthResponse>;
  containers: PolledResult<DockerContainersResponse>;
  system: PolledResult<DockerSystemResponse>;
  services: PolledResult<{ services: ServiceRow[] }>;
  backups: PolledResult<BackupsResponse>;
  vpn: PolledResult<VpnStatusResponse>;
  updates: PolledResult<WudUpdatesResponse>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: ReactNode }) {
  const dockerHealth = usePolled<DockerHealthResponse>(
    "/api/docker/health",
    DOCKER_HEALTH_INTERVAL_MS,
    INITIAL_DOCKER_HEALTH,
  );
  const containers = usePolled<DockerContainersResponse>(
    "/api/docker/containers",
    DOCKER_CONTAINERS_INTERVAL_MS,
    INITIAL_CONTAINERS,
  );
  const system = usePolled<DockerSystemResponse>(
    "/api/docker/system",
    DOCKER_SYSTEM_INTERVAL_MS,
    INITIAL_SYSTEM,
  );
  const services = usePolled<{ services: ServiceRow[] }>(
    "/api/services/health",
    SERVICES_INTERVAL_MS,
    INITIAL_SERVICES,
  );
  const backups = usePolled<BackupsResponse>(
    "/api/backups",
    BACKUP_POLL_INTERVAL_MS,
    INITIAL_BACKUPS,
  );
  const vpn = usePolled<VpnStatusResponse>(
    "/api/gluetun/status",
    VPN_POLL_INTERVAL_MS,
    INITIAL_VPN,
  );
  const updates = usePolled<WudUpdatesResponse>(
    "/api/wud/updates",
    UPDATES_POLL_INTERVAL_MS,
    INITIAL_UPDATES,
  );

  return (
    <DashboardContext.Provider
      value={{
        dockerHealth,
        containers,
        system,
        services,
        backups,
        vpn,
        updates,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error("useDashboard must be used within a DashboardProvider");
  }
  return ctx;
}
