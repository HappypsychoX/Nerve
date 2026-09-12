import { DOCKER_HEALTH_TIMEOUT_MS, DOCKER_TIMEOUT_MS, dockerFetch } from "./client";
import { toContainerStatus } from "./normalize";
import type { ContainerStatus } from "@/types";
import type {
  DockerContainerInspect,
  DockerContainerSummary,
  DockerInfo,
  DockerResult,
  DockerStats,
  DockerSystemData,
  DockerVersion,
} from "./types";

interface DockerSystemDf {
  LayersSize?: number;
  Images?: { Reclaimable?: number }[];
  Containers?: { Reclaimable?: number }[];
  Volumes?: { Reclaimable?: number }[];
  BuildCache?: { Reclaimable?: number }[];
}

async function safeDockerFetch(
  path: string,
  timeoutMs: number = DOCKER_TIMEOUT_MS,
): Promise<unknown | null> {
  const result = await dockerFetch(path, timeoutMs);
  if (!result.ok) return null;
  return result.data;
}

export async function getDockerHealth(): Promise<
  DockerResult<{ version: string | null }>
> {
  const result = await dockerFetch("/version", DOCKER_HEALTH_TIMEOUT_MS);
  if (!result.ok) return result;
  return { ok: true, data: { version: (result.data as DockerVersion).Version ?? null } };
}

export async function getContainers(): Promise<DockerResult<ContainerStatus[]>> {
  const listResult = await dockerFetch("/containers/json?all=1");
  if (!listResult.ok) return listResult;

  if (!Array.isArray(listResult.data)) return { ok: false, error: "http" };
  const summaries = listResult.data as DockerContainerSummary[];

  const statuses = await Promise.all(
    summaries.map(async (summary): Promise<ContainerStatus> => {
      const statsPromise: Promise<unknown | null> =
        summary.State === "running"
          ? safeDockerFetch(`/containers/${summary.Id}/stats?stream=0`)
          : Promise.resolve(null);

      const [inspectResult, statsResult] = await Promise.allSettled([
        safeDockerFetch(`/containers/${summary.Id}/json`),
        statsPromise,
      ]);

      const inspect =
        inspectResult.status === "fulfilled"
          ? (inspectResult.value as DockerContainerInspect | null)
          : null;
      const stats =
        statsResult.status === "fulfilled"
          ? (statsResult.value as DockerStats | null)
          : null;

      return toContainerStatus(summary, inspect, stats);
    }),
  );

  return { ok: true, data: statuses };
}

export async function getSystem(): Promise<{
  ok: true;
  data: DockerSystemData;
}> {
  const [versionRes, infoRes, imagesRes, dfRes] = await Promise.allSettled([
    dockerFetch("/version"),
    dockerFetch("/info"),
    dockerFetch("/images/json"),
    dockerFetch("/system/df"),
  ]);

  const versionReachable =
    versionRes.status === "fulfilled" && versionRes.value.ok;

  const version =
    versionRes.status === "fulfilled" && versionRes.value.ok
      ? (versionRes.value.data as DockerVersion).Version ?? null
      : null;

  const info =
    infoRes.status === "fulfilled" && infoRes.value.ok
      ? (infoRes.value.data as DockerInfo)
      : null;
  const memoryTotalBytes = info?.MemTotal ?? null;

  const imagesData =
    imagesRes.status === "fulfilled" && imagesRes.value.ok
      ? imagesRes.value.data
      : null;
  const images = Array.isArray(imagesData) ? imagesData.length : null;

  const df =
    dfRes.status === "fulfilled" && dfRes.value.ok
      ? (dfRes.value.data as DockerSystemDf)
      : null;
  const diskUsedBytes = df?.LayersSize ?? null;
  const diskReclaimableBytes = df
    ? [
        ...(df.Images ?? []),
        ...(df.Containers ?? []),
        ...(df.Volumes ?? []),
        ...(df.BuildCache ?? []),
      ].reduce((sum, item) => sum + (item.Reclaimable ?? 0), 0)
    : null;

  return {
    ok: true,
    data: {
      version,
      images,
      memoryTotalBytes,
      diskUsedBytes,
      diskReclaimableBytes,
      versionReachable,
    },
  };
}
