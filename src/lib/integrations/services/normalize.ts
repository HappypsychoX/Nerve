import type { ServiceHealth } from "@/types";
import type { ServiceProbe } from "./types";

export function mapProbeToHealth(
  probe: ServiceProbe,
): { health: ServiceHealth; detail: string } {
  if (probe.statusCode !== null) {
    if (probe.statusCode >= 200 && probe.statusCode <= 499) {
      return { health: "online", detail: `HTTP ${probe.statusCode}` };
    }
    if (probe.statusCode >= 500) {
      return { health: "degraded", detail: `HTTP ${probe.statusCode}` };
    }
  }
  if (probe.error === "timeout") {
    return { health: "offline", detail: "Timed out" };
  }
  if (probe.error === "network") {
    return { health: "offline", detail: "Unreachable" };
  }
  return { health: "offline", detail: "No response" };
}
