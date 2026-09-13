import { containerDisplayStatus, containerStateLabel } from "@/lib/health";
import type { ContainerRow } from "@/lib/integrations/docker/types";
import type { BackupsResponse } from "@/lib/integrations/backup/types";
import type { VpnStatusResponse } from "@/lib/integrations/gluetun/types";
import type { ServiceRow } from "@/lib/integrations/services/types";
import type { AttentionItem, AttentionSeverity, ContainerUpdate } from "@/types";

interface AttentionInputs {
  containers: ContainerRow[];
  updates: ContainerUpdate[];
  backups: BackupsResponse;
  vpn: VpnStatusResponse;
  services: ServiceRow[];
}

const SEVERITY_RANK: Record<AttentionSeverity, number> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export function buildAttentionItems(inputs: AttentionInputs): AttentionItem[] {
  const seen = new Set<string>();
  const items: AttentionItem[] = [];

  function push(item: AttentionItem) {
    if (seen.has(item.id)) return;
    seen.add(item.id);
    items.push(item);
  }

  for (const c of inputs.containers) {
    if (!c.critical) continue;
    const display = containerDisplayStatus(c.state, c.health);
    if (display === "healthy") continue;
    push({
      id: `container-${c.name}`,
      label: c.name,
      detail: containerStateLabel(c.state, c.health),
      severity: "critical",
    });
  }

  if (inputs.backups.health === "degraded") {
    push({
      id: "backup",
      label: "Backup",
      detail: inputs.backups.detail,
      severity: inputs.backups.detail.includes("failed") ? "critical" : "warning",
    });
  }

  if (inputs.vpn.health === "offline") {
    push({
      id: "vpn",
      label: "VPN",
      detail: inputs.vpn.detail,
      severity: "critical",
    });
  } else if (inputs.vpn.health === "degraded") {
    push({
      id: "vpn",
      label: "VPN",
      detail: inputs.vpn.detail,
      severity: "warning",
    });
  }

  for (const s of inputs.services) {
    if (!s.critical) continue;
    if (s.health === "offline") {
      push({
        id: `service-${s.id}`,
        label: s.name,
        detail: s.detail || "Offline",
        severity: "critical",
      });
    } else if (s.health === "degraded") {
      push({
        id: `service-${s.id}`,
        label: s.name,
        detail: s.detail || "Degraded",
        severity: "warning",
      });
    }
  }

  const pending = inputs.updates.filter((u) => u.updateAvailable).slice(0, 5);
  for (const u of pending) {
    push({
      id: `update-${u.containerId}`,
      label: u.containerName,
      detail: `${u.currentVersion ?? "?"} → ${u.availableVersion ?? "?"}`,
      severity: "info",
    });
  }

  items.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return a.label.localeCompare(b.label);
  });

  return items.slice(0, 12);
}
