"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import { computeOverallHealth } from "@/lib/health";
import type { ServiceRow } from "@/lib/integrations/services/types";
import type { IntegrationHealth } from "@/types";
import type { PolledMeta } from "@/hooks/use-polled";

export function useServicesHealth(): {
  services: ServiceRow[];
} & PolledMeta {
  const { services } = useDashboard();
  return {
    services: services.data.services,
    loading: services.loading,
    error: services.error,
    lastSuccessAt: services.lastSuccessAt,
    stale: services.stale,
  };
}

export function useOverallHealth(): IntegrationHealth {
  const { dockerHealth, containers, services, backups, vpn } = useDashboard();
  const criticalServices = services.data.services
    .filter((service) => service.critical)
    .map((service) => service.health);
  return computeOverallHealth({
    docker: dockerHealth.data.health,
    criticalServices,
    backup: backups.data.health,
    vpn: vpn.data.health,
    criticalContainers: containers.data.criticalCounts,
  });
}
