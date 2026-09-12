import type { ServiceConfig, ServiceGroup } from "./types";

export function containerGroupForName(
  services: ServiceConfig[],
  containerName: string,
): ServiceGroup {
  const normalized = containerName.replace(/^\/+/, "").toLowerCase();
  const match = services.find((s) => s.id.toLowerCase() === normalized);
  return match?.group ?? "other";
}
