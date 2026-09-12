import type { ContainerStatus, IntegrationHealth } from "@/types";

export interface SystemStatusRow {
  id: string;
  label: string;
  health: IntegrationHealth;
  detail: string;
}

export interface AttentionItem {
  id: string;
  label: string;
  detail: string;
}

export interface DockerSummary {
  cpuPercent: number;
  memoryUsed: string;
  memoryTotal: string;
  diskUsed: string;
  diskReclaimable: string;
  running: number;
  stopped: number;
  unhealthy: number;
  images: number;
  version: string;
}

export const overallHealth: IntegrationHealth = "healthy";

export const systemStatus: SystemStatusRow[] = [
  { id: "docker", label: "Docker", health: "healthy", detail: "14 running / 0 stopped" },
  { id: "backup", label: "Backup", health: "healthy", detail: "Success · 12h ago" },
  { id: "vpn", label: "VPN", health: "healthy", detail: "Connected · 185.xxx.xxx.xxx" },
  { id: "updates", label: "Updates", health: "degraded", detail: "3 available" },
];

export const attentionItems: AttentionItem[] = [
  { id: "wud", label: "WUD", detail: "3 updates available" },
  { id: "radarr", label: "Radarr", detail: "Update available" },
  { id: "sonarr", label: "Sonarr", detail: "Update available" },
  { id: "jellyfin", label: "Jellyfin", detail: "Update available" },
];

export const dockerSummary: DockerSummary = {
  cpuPercent: 28,
  memoryUsed: "6.2 GB",
  memoryTotal: "32 GB",
  diskUsed: "182 GB",
  diskReclaimable: "14.2 GB",
  running: 14,
  stopped: 0,
  unhealthy: 0,
  images: 21,
  version: "26.1.4",
};

const gib = 1024 ** 3;

export const containers: ContainerStatus[] = [
  { id: "c1", name: "jellyfin", image: "jellyfin/jellyfin:10.9.11", state: "running", health: "healthy", uptimeSeconds: 3 * 86400 + 14 * 3600, restartCount: 0, cpuPercent: 1.2, memoryBytes: 1.4 * gib },
  { id: "c2", name: "jellyseerr", image: "fallenbagel/jellyseerr:2.3.0", state: "running", health: "healthy", uptimeSeconds: 5 * 86400, restartCount: 0, cpuPercent: 0.1, memoryBytes: 240 * 1024 ** 2 },
  { id: "c3", name: "gluetun", image: "qmcgaw/gluetun:v3.40.0", state: "running", health: "healthy", uptimeSeconds: 7 * 86400, restartCount: 1, cpuPercent: 0.2, memoryBytes: 90 * 1024 ** 2 },
  { id: "c4", name: "qbittorrent", image: "lscr.io/linuxserver/qbittorrent:5.0.1", state: "running", health: "none", uptimeSeconds: 2 * 86400, restartCount: 0, cpuPercent: 2.8, memoryBytes: 620 * 1024 ** 2 },
  { id: "c5", name: "sonarr", image: "lscr.io/linuxserver/sonarr:4.0.13", state: "running", health: "healthy", uptimeSeconds: 12 * 86400, restartCount: 0, cpuPercent: 0.4, memoryBytes: 310 * 1024 ** 2 },
  { id: "c6", name: "radarr", image: "lscr.io/linuxserver/radarr:5.17.2", state: "running", health: "healthy", uptimeSeconds: 12 * 86400, restartCount: 0, cpuPercent: 0.3, memoryBytes: 280 * 1024 ** 2 },
  { id: "c7", name: "prowlarr", image: "lscr.io/linuxserver/prowlarr:1.29.2", state: "running", health: "healthy", uptimeSeconds: 12 * 86400, restartCount: 0, cpuPercent: 0.2, memoryBytes: 190 * 1024 ** 2 },
  { id: "c8", name: "portainer", image: "portainer/portainer-ce:2.25.1", state: "running", health: "healthy", uptimeSeconds: 30 * 86400, restartCount: 0, cpuPercent: 0.3, memoryBytes: 95 * 1024 ** 2 },
  { id: "c9", name: "wud", image: "fmartinou/whats-up-docker:7.5.0", state: "running", health: "healthy", uptimeSeconds: 30 * 86400, restartCount: 0, cpuPercent: 0.1, memoryBytes: 150 * 1024 ** 2 },
  { id: "c10", name: "offen", image: "offen/docker-volume-backup:2.42.0", state: "running", health: "none", uptimeSeconds: 30 * 86400, restartCount: 0, cpuPercent: 0.1, memoryBytes: 40 * 1024 ** 2 },
];
