import type { ServiceConfig } from "./types";
import { BACKUP_WATCH_PREFIX } from "@/lib/integrations/backup";
import type { ContainerUpdate } from "@/types";

export function normalizeContainerName(name: string): string {
  return name.trim().replace(/^\/+/, "").toLowerCase();
}

function hostnameFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function matchServiceForContainer(
  services: ServiceConfig[],
  containerName: string,
): ServiceConfig | null {
  const normalized = normalizeContainerName(containerName);
  const candidates = services.filter((service) => {
    const id = service.id.toLowerCase();
    const host = hostnameFromUrl(service.checkUrl ?? service.url);
    if (host && host === normalized) return true;
    return (
      normalized === id ||
      normalized.startsWith(`${id}-`) ||
      normalized.endsWith(`-${id}`) ||
      normalized.includes(`-${id}-`)
    );
  });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.id.length - a.id.length);
  return candidates[0] ?? null;
}

export function isCriticalContainer(
  services: ServiceConfig[],
  containerName: string,
  gluetunName: string,
): boolean {
  const normalized = normalizeContainerName(containerName);
  if (normalized === normalizeContainerName(gluetunName)) return true;
  if (normalized.startsWith(BACKUP_WATCH_PREFIX)) return true;
  const service = matchServiceForContainer(services, containerName);
  return service?.critical === true;
}

export function matchUpdateForContainer(
  updates: ContainerUpdate[],
  containerName: string,
): {
  updateAvailable: boolean;
  currentVersion: string | null;
  availableVersion: string | null;
} | null {
  const normalized = normalizeContainerName(containerName);
  const exact = updates.find(
    (u) => normalizeContainerName(u.containerName) === normalized,
  );
  if (exact) {
    return {
      updateAvailable: exact.updateAvailable,
      currentVersion: exact.currentVersion,
      availableVersion: exact.availableVersion,
    };
  }
  const fallback = updates.find((u) => {
    const un = normalizeContainerName(u.containerName);
    if (un.length < 3 || normalized.length < 3) return false;
    return normalized.endsWith(un) || un.endsWith(normalized);
  });
  if (fallback) {
    return {
      updateAvailable: fallback.updateAvailable,
      currentVersion: fallback.currentVersion,
      availableVersion: fallback.availableVersion,
    };
  }
  return null;
}
