import { getQuickLinks, loadConfig } from "@/lib/config";
import {
  attentionItems,
  containers,
  dockerSummary,
  systemStatus,
} from "@/lib/mock/dashboard";
import { SystemStatus } from "@/components/dashboard/system-status";
import { AttentionPanel } from "@/components/dashboard/attention-panel";
import { DockerPanel } from "@/components/dashboard/docker-panel";
import { ContainersPreview } from "@/components/dashboard/containers-preview";
import { QuickAccess } from "@/components/dashboard/quick-access";

export default function OverviewPage() {
  const config = loadConfig();
  const quickLinks = getQuickLinks(config);

  return (
    <div className="space-y-4">
      <SystemStatus rows={systemStatus} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AttentionPanel items={attentionItems} />
        <DockerPanel summary={dockerSummary} />
      </div>

      <ContainersPreview containers={containers} />

      <QuickAccess links={quickLinks} />
    </div>
  );
}
