import type { ContainerUpdate } from "@/types";
import type { WudContainer } from "./types";

export function extractContainers(payload: unknown): unknown[] | null {
  if (Array.isArray(payload)) return payload;
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { containers?: unknown }).containers)
  ) {
    return (payload as { containers: unknown[] }).containers;
  }
  return null;
}

export function toContainerUpdate(raw: unknown): ContainerUpdate {
  const c = (raw ?? {}) as WudContainer;
  const updateKind = c.updateKind ?? c.update;
  const updateAvailable = c.updateAvailable === true;
  const currentVersion = c.image?.tag?.value ?? updateKind?.localValue ?? null;
  const availableVersion = updateAvailable
    ? (c.result?.tag ?? updateKind?.remoteValue ?? null)
    : null;
  return {
    containerId: typeof c.id === "string" ? c.id : "",
    containerName: (typeof c.name === "string" && c.name
      ? c.name
      : typeof c.displayName === "string" && c.displayName
        ? c.displayName
        : typeof c.id === "string"
          ? c.id
          : ""
    ).trim(),
    currentVersion,
    availableVersion,
    updateAvailable,
  };
}
