import { Archive } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { StatusPill } from "@/components/ui/status-dot";
import { formatBytes, formatDateTime, formatUptime } from "@/lib/utils";
import type { BackupsResponse } from "@/lib/integrations/backup/types";
import type { BackupRun, BackupStorageStatus } from "@/types";

export function storageLabel(status: BackupStorageStatus): string {
  if (status === "success") return "ok";
  if (status === "failure") return "failed";
  if (status === "skipped") return "skipped";
  return "—";
}

function sourceLabel(latest: BackupRun): string {
  if (latest.source === "cloudflare") return "Cloud";
  if (latest.source === "local") return "Local";
  return "—";
}

export function BackupCard({ data }: { data: BackupsResponse }) {
  const latest = data.latest;

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Backup"
        action={<Archive className="h-4 w-4 text-faint" />}
      />
      <div className="flex-1 space-y-4 px-4 py-4">
        <StatusPill health={data.health} label={data.detail} />

        {data.dbError ? (
          <div className="py-2 text-sm text-muted">
            Could not load backup history
          </div>
        ) : latest ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Started"
                value={formatDateTime(new Date(latest.startedAt).toISOString())}
              />
              <Metric
                label="Duration"
                value={formatUptime(latest.durationSeconds)}
              />
              <Metric label="Size" value={formatBytes(latest.sizeBytes)} />
              <Metric label="Source" value={sourceLabel(latest)} />
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-xs">
              <span className="text-muted">Local</span>
              <span className="font-mono text-fg">
                {storageLabel(latest.localStatus)}
              </span>
              <span className="pl-4 text-muted">S3</span>
              <span className="font-mono text-fg">
                {storageLabel(latest.s3Status)}
              </span>
            </div>
          </>
        ) : (
          <div className="py-2 text-sm text-muted">
            {data.health === "unknown" && data.detail === "Backup tool down"
              ? "Backup tool down"
              : "No backups recorded"}
          </div>
        )}
      </div>
    </Card>
  );
}
