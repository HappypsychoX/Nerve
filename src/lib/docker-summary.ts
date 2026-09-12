import type {
  ContainerStatus,
  DockerAggregate,
  DockerContainerCounts,
  DockerSummary,
} from "@/types";
import type {
  DockerContainersResponse,
  DockerSystemResponse,
} from "@/lib/integrations/docker/types";

export function summarizeContainers(containers: ContainerStatus[]): {
  counts: DockerContainerCounts;
  aggregate: DockerAggregate;
} {
  const counts: DockerContainerCounts = { running: 0, stopped: 0, unhealthy: 0 };
  let cpuSum = 0;
  let memSum = 0;
  let cpuKnown = false;
  let memKnown = false;
  for (const c of containers) {
    if (c.state === "running") counts.running += 1;
    else if (c.state === "stopped") counts.stopped += 1;
    if (c.health === "unhealthy") counts.unhealthy += 1;
    if (c.cpuPercent !== null) { cpuSum += c.cpuPercent; cpuKnown = true; }
    if (c.memoryBytes !== null) { memSum += c.memoryBytes; memKnown = true; }
  }
  return {
    counts,
    aggregate: {
      cpuPercent: cpuKnown ? Math.min(100, Math.round(cpuSum * 10) / 10) : null,
      memoryUsedBytes: memKnown ? memSum : null,
    },
  };
}

export function composeDockerSummary(
  containers: DockerContainersResponse,
  system: DockerSystemResponse,
): DockerSummary {
  return {
    cpuPercent: containers.aggregate.cpuPercent,
    memoryUsedBytes: containers.aggregate.memoryUsedBytes,
    memoryTotalBytes: system.memoryTotalBytes,
    diskUsedBytes: system.diskUsedBytes,
    diskReclaimableBytes: system.diskReclaimableBytes,
    running: containers.counts.running,
    stopped: containers.counts.stopped,
    unhealthy: containers.counts.unhealthy,
    images: system.images,
    version: system.version,
  };
}
