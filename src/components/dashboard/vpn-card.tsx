import { Shield } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdatedHint } from "@/components/ui/updated-hint";
import { StatusPill } from "@/components/ui/status-dot";
import type { VpnStatusResponse } from "@/lib/integrations/gluetun/types";
import type { VpnState, VpnStatus } from "@/types";
import type { PolledMeta } from "@/hooks/use-polled";

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

interface VpnCardProps {
  data: VpnStatusResponse;
  meta: PolledMeta;
}

export function VpnCard({ data, meta }: VpnCardProps) {
  const { loading, error, stale, lastSuccessAt } = meta;
  const { status } = data;

  if (loading) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader title="VPN" />
        <div className="flex-1 space-y-4 px-4 py-4">
          <Skeleton className="h-6 w-24" />
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (error && lastSuccessAt === null) {
    return (
      <Card className="flex h-full flex-col">
        <CardHeader title="VPN" />
        <div className="flex-1 px-4 py-4 text-sm text-muted">
          Unavailable — retrying
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="VPN"
        hint={<UpdatedHint lastSuccessAt={lastSuccessAt} stale={stale} />}
        action={<Shield className="h-4 w-4 text-faint" />}
      />
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
