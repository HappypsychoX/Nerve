"use client";

import { useEffect, useState } from "react";
import type {
  DockerContainersResponse,
  DockerHealthResponse,
  DockerSystemResponse,
} from "@/lib/integrations/docker/types";
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

export function useDockerHealth(intervalMs = 5000): IntegrationHealth {
  const initial: DockerHealthResponse = { health: "unknown", version: null };
  const { data } = usePolled<DockerHealthResponse>(
    "/api/docker/health",
    intervalMs,
    initial,
  );
  return data.health;
}

export function useDockerContainers(
  intervalMs = 5000,
): DockerContainersResponse & { loading: boolean } {
  const initial: DockerContainersResponse = {
    health: "unknown",
    containers: [],
    counts: { running: 0, stopped: 0, unhealthy: 0 },
    aggregate: { cpuPercent: null, memoryUsedBytes: null },
  };
  const { data, loading } = usePolled<DockerContainersResponse>(
    "/api/docker/containers",
    intervalMs,
    initial,
  );
  return { ...data, loading };
}

export function useDockerSystem(
  intervalMs = 300000,
): DockerSystemResponse & { loading: boolean } {
  const initial: DockerSystemResponse = {
    health: "unknown",
    version: null,
    images: null,
    memoryTotalBytes: null,
    diskUsedBytes: null,
    diskReclaimableBytes: null,
  };
  const { data, loading } = usePolled<DockerSystemResponse>(
    "/api/docker/system",
    intervalMs,
    initial,
  );
  return { ...data, loading };
}
