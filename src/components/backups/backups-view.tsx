"use client";

import { Card, CardHeader } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { StatusDot, StatusPill } from "@/components/ui/status-dot";
import { useBackups } from "@/hooks/use-backups";
import { formatBytes, formatDateTime, formatUptime } from "@/lib/utils";
import type { BackupSource, BackupStorageStatus } from "@/types";

function sourceLabel(source: BackupSource | null): string {
  if (source === "cloudflare") return "Cloud";
  if (source === "local") return "Local";
  return "—";
}

function storageLabel(status: BackupStorageStatus): string {
  if (status === "success") return "ok";
  if (status === "failure") return "failed";
  if (status === "skipped") return "skipped";
  return "—";
}

export function BackupsView() {
  const backups = useBackups();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Backups"
          hint={
            backups.containerStatus.names.length > 0
              ? `${backups.containerStatus.names.length} watched`
              : undefined
          }
        />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <StatusPill health={backups.health} label={backups.detail} />
          <span className="text-2xs text-faint">
            {backups.containerStatus.names.length === 0
              ? "No containers watched"
              : backups.containerStatus.running
                ? "Tool running"
                : "Tool down"}
          </span>
        </div>
        {backups.dbError ? (
          <div className="px-4 pb-4 text-xs text-degraded">
            Could not load backup history
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Latest Result" />
        {backups.latest ? (
          <div className="space-y-3 px-4 py-4">
            <div className="flex items-center gap-2.5">
              <StatusDot
                health={backups.latest.status === "success" ? "healthy" : "degraded"}
              />
              <span className="text-sm font-medium text-fg">
                {backups.latest.status === "success" ? "Success" : "Failure"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Started"
                value={formatDateTime(
                  new Date(backups.latest.startedAt).toISOString(),
                )}
              />
              <Metric
                label="Duration"
                value={formatUptime(backups.latest.durationSeconds)}
              />
              <Metric
                label="Size"
                value={formatBytes(backups.latest.sizeBytes)}
              />
              <Metric
                label="Source"
                value={sourceLabel(backups.latest.source)}
              />
              <Metric
                label="Local"
                value={storageLabel(backups.latest.localStatus)}
              />
              <Metric
                label="S3"
                value={storageLabel(backups.latest.s3Status)}
              />
            </div>
            {backups.latest.filename ? (
              <div className="break-all text-xs text-muted">
                {backups.latest.filename}
              </div>
            ) : null}
            {backups.latest.error ? (
              <div className="break-all text-xs text-degraded">
                {backups.latest.error}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted">
            No backup runs yet
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="History"
          hint={backups.runs.length > 0 ? `${backups.runs.length} recorded` : undefined}
        />
        {backups.runs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            No backup runs yet
          </div>
        ) : (
          <div className="divide-y divide-line">
            <div className="grid grid-cols-5 gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted">
              <span>Status</span>
              <span>When</span>
              <span>Source</span>
              <span>Size</span>
              <span>Duration</span>
            </div>
            {backups.runs.map((run) => (
              <div key={run.id} className="px-4 py-2.5 hover:bg-surface-2/50">
                <div className="grid grid-cols-5 gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <StatusDot
                      health={run.status === "success" ? "healthy" : "degraded"}
                    />
                    <span className="text-fg">
                      {run.status === "success" ? "Success" : "Failed"}
                    </span>
                  </span>
                  <span className="font-mono text-muted">
                    {formatDateTime(new Date(run.startedAt).toISOString())}
                  </span>
                  <span className="text-muted">{sourceLabel(run.source)}</span>
                  <span className="font-mono text-muted">
                    {formatBytes(run.sizeBytes)}
                  </span>
                  <span className="font-mono text-muted">
                    {formatUptime(run.durationSeconds)}
                  </span>
                </div>
                {run.error ? (
                  <div className="mt-1 truncate text-xs text-degraded">
                    {run.error}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
