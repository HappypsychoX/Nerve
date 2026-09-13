import type { ServiceConfig, ServiceGroup } from "./types";
import { matchServiceForContainer } from "./matching";

export function containerGroupForName(
  services: ServiceConfig[],
  containerName: string,
): ServiceGroup {
  return matchServiceForContainer(services, containerName)?.group ?? "other";
}
