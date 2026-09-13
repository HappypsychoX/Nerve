import { NextResponse } from "next/server";
import { getContainers } from "@/lib/integrations/docker";
import {
  containerGroupForName,
  isCriticalContainer,
  loadConfig,
} from "@/lib/config";
import { GLUETUN_CONTAINER_NAME } from "@/lib/integrations/gluetun";
import { summarizeContainers } from "@/lib/docker-summary";
import type { ContainerRow } from "@/lib/integrations/docker/types";
import type { IntegrationHealth } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const result = await getContainers();
  if (!result.ok) {
    console.warn("[docker] container list failed:", result.error);
    return NextResponse.json(
      {
        health: "offline",
        containers: [],
        counts: { running: 0, stopped: 0, unhealthy: 0 },
        aggregate: { cpuPercent: null, memoryUsedBytes: null },
        criticalCounts: { stopped: 0, unhealthy: 0, restarting: 0 },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { counts, aggregate } = summarizeContainers(result.data);
  const config = loadConfig();
  const containers: ContainerRow[] = result.data.map((container) => ({
    ...container,
    group: containerGroupForName(config.services, container.name),
    critical: isCriticalContainer(
      config.services,
      container.name,
      GLUETUN_CONTAINER_NAME,
    ),
  }));

  const criticalCounts = {
    stopped: containers.filter((c) => c.critical && c.state === "stopped")
      .length,
    unhealthy: containers.filter((c) => c.critical && c.health === "unhealthy")
      .length,
    restarting: containers.filter((c) => c.critical && c.state === "restarting")
      .length,
  };

  const health: IntegrationHealth =
    criticalCounts.stopped > 0 ||
    criticalCounts.unhealthy > 0 ||
    criticalCounts.restarting > 0
      ? "degraded"
      : "healthy";

  return NextResponse.json(
    { health, containers, counts, aggregate, criticalCounts },
    { headers: { "Cache-Control": "no-store" } },
  );
}
