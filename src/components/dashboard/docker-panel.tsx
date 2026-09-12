import { Cpu, HardDrive, MemoryStick, Server } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Metric, ProgressBar } from "@/components/ui/metric";
import { formatBytes } from "@/lib/utils";
import type { DockerSummary } from "@/types";

export function DockerPanel({ summary }: { summary: DockerSummary }) {
  const memoryPercent = summary.memoryTotalBytes
    ? Math.round(
        ((summary.memoryUsedBytes ?? 0) / summary.memoryTotalBytes) * 100,
      )
    : 0;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Docker"
        hint={summary.version ? `v${summary.version}` : undefined}
        action={<Server className="h-4 w-4 text-faint" />}
      />
      <div className="flex-1 space-y-4 px-4 py-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <Cpu className="h-3.5 w-3.5 text-faint" /> CPU
            </span>
            <span className="font-mono text-fg">
              {summary.cpuPercent === null
                ? "—"
                : `${summary.cpuPercent.toFixed(0)}%`}
            </span>
          </div>
          <ProgressBar percent={summary.cpuPercent ?? 0} />
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted">
              <MemoryStick className="h-3.5 w-3.5 text-faint" /> Memory
            </span>
            <span className="font-mono text-fg">
              {formatBytes(summary.memoryUsedBytes)}
            </span>
          </div>
          <ProgressBar percent={memoryPercent} tone="healthy" />
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted">
            <HardDrive className="h-3.5 w-3.5 text-faint" />
            <span className="font-mono text-fg">
              {formatBytes(summary.diskUsedBytes)}
            </span>
            <span className="text-faint">Docker data</span>
          </div>
          <div className="flex items-center gap-1.5 pl-5 text-2xs text-faint">
            <span className="font-mono text-fg">
              {formatBytes(summary.diskReclaimableBytes)}
            </span>
            <span>reclaimable</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-line pt-3">
          <Metric label="Running" value={summary.running} />
          <Metric label="Stopped" value={summary.stopped} />
          <Metric label="Images" value={summary.images ?? 0} />
        </div>
      </div>
    </Card>
  );
}
