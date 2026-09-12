export type ServiceGroup =
  | "media"
  | "downloads"
  | "infrastructure"
  | "monitoring"
  | "remote-access"
  | "other";

export interface ServiceConfig {
  id: string;
  name: string;
  url?: string;
  checkUrl?: string;
  group: ServiceGroup;
  critical?: boolean;
  icon?: string;
}

export interface ServiceGroupConfig {
  id: ServiceGroup;
  name: string;
}

export interface NerveConfig {
  title: string;
  serverName: string;
  groups: ServiceGroupConfig[];
  services: ServiceConfig[];
}
