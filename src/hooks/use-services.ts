"use client";

import { useEffect, useState } from "react";
import { useDockerHealth } from "@/hooks/use-docker";
import { computeOverallHealth } from "@/lib/health";
import type { ServiceRow } from "@/lib/integrations/services/types";
import type { IntegrationHealth } from "@/types";

function usePolled<T>(
  url: string,
  intervalMs: number,
  initial: T,
): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as T;
        if (active) setData(json);
      } catch {
        // keep previous data on failure; do not flip to offline
      } finally {
        if (active) setLoading(false);
      }
    };

    tick();
    const timer = setInterval(tick, intervalMs);

    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [url, intervalMs]);

  return { data, loading };
}

export function useServicesHealth(
  intervalMs = 30000,
): { services: ServiceRow[]; loading: boolean } {
  const initial: { services: ServiceRow[] } = { services: [] };
  const { data, loading } = usePolled<{ services: ServiceRow[] }>(
    "/api/services/health",
    intervalMs,
    initial,
  );
  return { services: data.services, loading };
}

export function useOverallHealth(): IntegrationHealth {
  const docker = useDockerHealth(5000);
  const { services } = useServicesHealth(30000);
  const criticalServices = services
    .filter((service) => service.critical)
    .map((service) => service.health);
  return computeOverallHealth(docker, criticalServices);
}
