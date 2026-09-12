"use client";

import type { ServiceConfig } from "@/lib/config";
import type { SystemStatusRow } from "@/types";
import { composeDockerSummary } from "@/lib/docker-summary";
import { useDockerContainers, useDockerSystem } from "@/hooks/use-docker";
import { useServicesHealth } from "@/hooks/use-services";
import { summarizeServices } from "@/lib/health";
import { SystemStatus } from "@/components/dashboard/system-status";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import { DockerPanel } from "@/components/dashboard/docker-panel";
import { ContainersPreview } from "@/components/dashboard/containers-preview";
import { ServicesPanel } from "@/components/dashboard/services-panel";
import { QuickAccess } from "@/components/dashboard/quick-access";
import { attentionItems, placeholderSystemRows } from "@/lib/mock/dashboard";

export function Overview({ quickLinks }: { quickLinks: ServiceConfig[] }) {
  const containers = useDockerContainers();
  const system = useDockerSystem();
  const { services } = useServicesHealth();
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

  return (
    <div className="space-y-4">
      <SystemStatus rows={[dockerRow, servicesRow, ...placeholderSystemRows]} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionPanel items={attentionItems} />
        <DockerPanel summary={summary} />
      </div>

      <ServicesPanel services={services} />

      <ContainersPreview containers={containers.containers} />

      <QuickAccess links={quickLinks} />
    </div>
  );
}
