import type { ServiceConfig } from "@/lib/config";
import { probeUrl } from "./client";
import { mapProbeToHealth } from "./normalize";
import type { ServiceRow } from "./types";

export async function checkServices(
  services: ServiceConfig[],
): Promise<ServiceRow[]> {
  return Promise.all(
    services.map(async (service): Promise<ServiceRow> => {
      const url = service.url ?? null;
      const critical = Boolean(service.critical);
      const group = service.group;

      if (!service.checkUrl) {
        return {
          id: service.id,
          name: service.name,
          group,
          url,
          health: "unknown",
          statusCode: null,
          detail: "Not configured",
          critical,
          checkedAt: null,
        };
      }

      try {
        const probe = await probeUrl(service.checkUrl);
        const { health, detail } = mapProbeToHealth(probe);
        return {
          id: service.id,
          name: service.name,
          group,
          url,
          health,
          statusCode: probe.statusCode,
          detail,
          critical,
          checkedAt: new Date().toISOString(),
        };
      } catch {
        return {
          id: service.id,
          name: service.name,
          group,
          url,
          health: "offline",
          statusCode: null,
          detail: "Unreachable",
          critical,
          checkedAt: new Date().toISOString(),
        };
      }
    }),
  );
}
