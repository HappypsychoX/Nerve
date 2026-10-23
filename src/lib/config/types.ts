export type ServiceGroup =
  | "media"
  | "downloads"
  | "infrastructure"
  | "monitoring"
  | "remote-access"
  | "other";

export interface ServiceCheckTls {
  // Trusted PEM certificate/CA for this service probe only.
  caFile: string;
  // Optional DNS SAN used for SNI and normal TLS hostname verification.
  serverName?: string;
}

export interface ServiceConfig {
  id: string;
  name: string;
  url?: string;
  checkUrl?: string;
  checkTls?: ServiceCheckTls;
  group: ServiceGroup;
  critical?: boolean;
  icon?: string;
}

// Display-only Jellyfin toggles. Connection details (JELLYFIN_URL and
// JELLYFIN_API_KEY) are environment variables and must never appear here.
export interface JellyfinDisplayConfig {
  enabled: boolean;
  showPosters: boolean;
  showIdleClients: boolean;
}

export const DEFAULT_JELLYFIN_DISPLAY: JellyfinDisplayConfig = {
  enabled: true,
  showPosters: true,
  showIdleClients: true,
};

export interface ServiceGroupConfig {
  id: ServiceGroup;
  name: string;
}

export interface NerveConfig {
  title: string;
  serverName: string;
  groups: ServiceGroupConfig[];
  services: ServiceConfig[];
  jellyfin?: JellyfinDisplayConfig;
}
