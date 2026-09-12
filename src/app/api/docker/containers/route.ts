import { NextResponse } from "next/server";
import { getContainers } from "@/lib/integrations/docker";
import { containerGroupForName, loadConfig } from "@/lib/config";
import { summarizeContainers } from "@/lib/docker-summary";
import type { ContainerRow } from "@/lib/integrations/docker/types";

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
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }

  const { counts, aggregate } = summarizeContainers(result.data);
  const config = loadConfig();
  const containers: ContainerRow[] = result.data.map((container) => ({
    ...container,
    group: containerGroupForName(config.services, container.name),
  }));

  return NextResponse.json(
    { health: "healthy", containers, counts, aggregate },
    { headers: { "Cache-Control": "no-store" } },
  );
}
