import type { ContainerHealth, ContainerState, ContainerStatus } from "@/types";
import type { DockerContainerInspect, DockerContainerSummary, DockerStats } from "./types";

export function mapState(raw: string): ContainerState {
  if (raw === "running") return "running";
  if (raw === "restarting") return "restarting";
  if (["exited", "dead", "created", "paused", "removing"].includes(raw)) return "stopped";
  return "unknown";
}

export function mapHealth(inspect: DockerContainerInspect | null): ContainerHealth {
  const status = inspect?.State?.Health?.Status;
  if (status === "healthy") return "healthy";
  if (status === "unhealthy") return "unhealthy";
  if (status === "starting") return "starting";
  return "none";
}

export function computeUptimeSeconds(inspect: DockerContainerInspect | null): number | null {
  if (!inspect) return null;
  const state = inspect.State?.Status;
  if (state !== "running") return null;
  const started = inspect.State?.StartedAt;
  if (!started) return null;
  const t = Date.parse(started);
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 1000);
}

export function computeCpuPercent(stats: DockerStats | null): number | null {
  if (!stats) return null;
  const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
  const sysDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const online = stats.cpu_stats.online_cpus ?? 1;
  if (sysDelta <= 0 || online <= 0) return null;
  return (cpuDelta / sysDelta) * online * 100;
}

export function toContainerStatus(
  summary: DockerContainerSummary,
  inspect: DockerContainerInspect | null,
  stats: DockerStats | null,
): ContainerStatus {
  const name = (summary.Names[0] ?? "").replace(/^\/+/, "");
  const image = summary.Image || summary.ImageID?.slice(7, 19) || "";
  return {
    id: summary.Id,
    name,
    image,
    state: mapState(inspect?.State?.Status ?? summary.State),
    health: mapHealth(inspect),
    uptimeSeconds: computeUptimeSeconds(inspect),
    restartCount: inspect?.RestartCount ?? 0,
    cpuPercent: computeCpuPercent(stats),
    memoryBytes: stats?.memory_stats?.usage ?? null,
  };
}
