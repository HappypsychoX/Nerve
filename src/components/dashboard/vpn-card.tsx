import { Shield } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { StatusPill } from "@/components/ui/status-dot";
import type { VpnStatusResponse } from "@/lib/integrations/gluetun/types";
import type { VpnState, VpnStatus } from "@/types";

const VPN_STATE_LABEL: Record<VpnState, string> = {
  running: "Connected",
  stopped: "Stopped",
  unknown: "Unknown",
};

function containerLabel(status: VpnStatus): string {
  if (status.containerHealthy === true) return "running";
  if (status.containerState === "restarting") return "restarting";
  if (status.containerState === "stopped") return "stopped";
  if (status.containerHealthy === false) return "unhealthy";
  return "unknown";
}

export function VpnCard({ data }: { data: VpnStatusResponse }) {
  const { status } = data;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader title="VPN" action={<Shield className="h-4 w-4 text-faint" />} />
      <div className="flex-1 space-y-4 px-4 py-4">
        <StatusPill health={data.health} label={data.detail} />
        <div className="grid grid-cols-2 gap-3">
          <Metric label="State" value={VPN_STATE_LABEL[status.state]} />
          <Metric label="Public IP" value={status.publicIp ?? "—"} />
          <Metric label="Container" value={containerLabel(status)} />
        </div>
      </div>
    </Card>
  );
}
