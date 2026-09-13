"use client";

import { useMemo } from "react";
import type { ServiceConfig } from "@/lib/config";
import type { SystemStatusRow } from "@/types";
import { composeDockerSummary } from "@/lib/docker-summary";
import { buildAttentionItems } from "@/lib/attention";
import {
  useDockerContainers,
  useDockerHealth,
  useDockerSystem,
} from "@/hooks/use-docker";
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
  const services = useServicesHealth();
  const updates = useUpdates();
  const backups = useBackups();
  const vpn = useVpn();
  const dockerHealth = useDockerHealth();
  const summary = composeDockerSummary(containers, system);

  const criticalDown =
    containers.criticalCounts.stopped +
    containers.criticalCounts.unhealthy +
    containers.criticalCounts.restarting;

  const dockerRow: SystemStatusRow = {
    id: "docker",
    label: "Docker",
    health: containers.health,
    detail: `${containers.counts.running} running / ${containers.counts.stopped} stopped${
      criticalDown > 0 ? ` · ${criticalDown} critical down` : ""
    }`,
  };

  const servicesSummary = summarizeServices(services.services);
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

  const attention = useMemo(
    () =>
      buildAttentionItems({
        containers: containers.containers,
        updates: updates.updates,
        backups,
        vpn,
        services: services.services,
      }),
    [containers.containers, updates.updates, backups, vpn, services.services],
  );

  return (
    <div className="space-y-4">
      <SystemStatus
        rows={[dockerRow, servicesRow, updatesRow, backupRow, vpnRow]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionPanel items={attention} />
        <DockerPanel summary={summary} meta={containers} health={containers.health} />
        <BackupCard data={backups} meta={backups} />
        <VpnCard data={vpn} meta={vpn} />
      </div>

      <ServicesPanel services={services.services} meta={services} />

      <ContainersPreview
        containers={containers.containers}
        loading={containers.loading}
        error={containers.error}
        stale={containers.stale}
        lastSuccessAt={containers.lastSuccessAt}
        dockerHealth={dockerHealth}
        updates={updates.updates}
      />

      <QuickAccess links={quickLinks} />
    </div>
  );
}
