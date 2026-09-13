"use client";

import { useMemo } from "react";
import type { ServiceConfig } from "@/lib/config";
import type { AttentionItem, SystemStatusRow } from "@/types";
import { composeDockerSummary } from "@/lib/docker-summary";
import { useDockerContainers, useDockerSystem } from "@/hooks/use-docker";
import { useServicesHealth } from "@/hooks/use-services";
import { useUpdates } from "@/hooks/use-updates";
import { useBackups } from "@/hooks/use-backups";
import { useVpn } from "@/hooks/use-vpn";
import { summarizeServices } from "@/lib/health";
import { SystemStatus } from "@/components/dashboard/system-status";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import { DockerPanel } from "@/components/dashboard/docker-panel";
import { BackupCard } from "@/components/dashboard/backup-card";
import { VpnCard } from "@/components/dashboard/vpn-card";
import { ContainersPreview } from "@/components/dashboard/containers-preview";
import { ServicesPanel } from "@/components/dashboard/services-panel";
import { QuickAccess } from "@/components/dashboard/quick-access";

export function Overview({ quickLinks }: { quickLinks: ServiceConfig[] }) {
  const containers = useDockerContainers();
  const system = useDockerSystem();
  const { services } = useServicesHealth();
  const updates = useUpdates();
  const backups = useBackups();
  const vpn = useVpn();
  const summary = composeDockerSummary(containers, system);

  const dockerRow: SystemStatusRow = {
    id: "docker",
    label: "Docker",
    health: containers.health,
    detail: `${containers.counts.running} running / ${containers.counts.stopped} stopped`,
  };

  const servicesSummary = summarizeServices(services);
  const servicesRow: SystemStatusRow = {
    id: "services",
    label: "Services",
    health: servicesSummary.health,
    detail: servicesSummary.detail,
  };

  const updatesRow: SystemStatusRow = {
    id: "updates",
    label: "Updates",
    health: updates.health,
    detail: updates.detail,
  };

  const backupRow: SystemStatusRow = {
    id: "backup",
    label: "Backup",
    health: backups.health,
    detail: backups.detail,
  };

  const vpnRow: SystemStatusRow = {
    id: "vpn",
    label: "VPN",
    health: vpn.health,
    detail: vpn.status.publicIp ?? vpn.detail,
  };

  const attention = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    if (updates.count > 0) {
      items.push({
        id: "wud",
        label: "WUD",
        detail: `${updates.count} update${updates.count === 1 ? "" : "s"}`,
      });
    }
    for (const u of updates.updates) {
      if (u.updateAvailable) {
        items.push({
          id: `update-${u.containerId}`,
          label: u.containerName,
          detail: "Update available",
        });
      }
    }
    return items;
  }, [updates]);

  return (
    <div className="space-y-4">
      <SystemStatus
        rows={[dockerRow, servicesRow, updatesRow, backupRow, vpnRow]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionPanel items={attention} />
        <DockerPanel summary={summary} />
        <BackupCard data={backups} />
        <VpnCard data={vpn} />
      </div>

      <ServicesPanel services={services} />

      <ContainersPreview containers={containers.containers} />

      <QuickAccess links={quickLinks} />
    </div>
  );
}
