"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type {
  DockerContainersResponse,
  DockerSystemResponse,
} from "@/lib/integrations/docker/types";
import type { IntegrationHealth } from "@/types";
import type { PolledMeta } from "@/hooks/use-polled";

export function useDockerHealth(): IntegrationHealth {
  const { dockerHealth } = useDashboard();
  return dockerHealth.data.health;
}

export function useDockerContainers(): DockerContainersResponse & PolledMeta {
  const { containers } = useDashboard();
  return {
    ...containers.data,
    loading: containers.loading,
    error: containers.error,
    lastSuccessAt: containers.lastSuccessAt,
    stale: containers.stale,
  };
}

export function useDockerSystem(): DockerSystemResponse & PolledMeta {
  const { system } = useDashboard();
  return {
    ...system.data,
    loading: system.loading,
    error: system.error,
    lastSuccessAt: system.lastSuccessAt,
    stale: system.stale,
  };
}
