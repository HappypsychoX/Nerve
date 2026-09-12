import { fetchWudContainers, wudBaseUrl } from "./client";
import { extractContainers, toContainerUpdate } from "./normalize";
import type {
  WudErrorKind,
  WudResult,
  WudUpdatesData,
  WudUpdatesResponse,
} from "./types";

const WUD_ERROR_DETAIL: Record<WudErrorKind, string> = {
  unconfigured: "Not configured",
  timeout: "Timed out",
  network: "Unreachable",
  http: "Error",
  auth: "Auth failed",
};

export async function getWudUpdates(): Promise<WudResult<WudUpdatesData>> {
  if (!wudBaseUrl()) return { ok: false, error: "unconfigured" };
  const result = await fetchWudContainers();
  if (!result.ok) return { ok: false, error: result.error };
  const containers = extractContainers(result.data);
  if (!containers) return { ok: false, error: "http" };
  return {
    ok: true,
    data: {
      updates: containers.map(toContainerUpdate),
      fetchedAt: new Date().toISOString(),
    },
  };
}

export function buildWudUpdatesResponse(
  result: WudResult<WudUpdatesData>,
  wudUrl: string | null,
): WudUpdatesResponse {
  if (!result.ok) {
    return {
      health: "unknown",
      detail: WUD_ERROR_DETAIL[result.error],
      updates: [],
      count: 0,
      total: 0,
      fetchedAt: null,
      wudUrl,
    };
  }
  const count = result.data.updates.filter((u) => u.updateAvailable).length;
  return {
    health: count > 0 ? "degraded" : "healthy",
    detail: count > 0 ? `${count} available` : "Up to date",
    updates: result.data.updates,
    count,
    total: result.data.updates.length,
    fetchedAt: result.data.fetchedAt,
    wudUrl,
  };
}
