import type { ServiceGroup } from "@/lib/config";
import type { ServiceHealth } from "@/types";

export type ServiceErrorKind = "timeout" | "network";

export interface ServiceProbe {
  statusCode: number | null;
  error: ServiceErrorKind | null;
}

export interface ServiceRow {
  id: string;
  name: string;
  group: ServiceGroup;
  url: string | null;
  health: ServiceHealth;
  statusCode: number | null;
  detail: string;
  critical: boolean;
  checkedAt: string | null;
}

export interface ServicesHealthResponse {
  services: ServiceRow[];
}
