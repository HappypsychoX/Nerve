"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-dot";
import { useUpdates } from "@/hooks/use-updates";
import { formatDateTime } from "@/lib/utils";

export function UpdatesView() {
  const updates = useUpdates();
  const pending = updates.updates.filter((u) => u.updateAvailable);
  const loading = updates.loading;
  const hasData = updates.lastSuccessAt !== null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Updates"
          hint={
            updates.health !== "unknown" ? `${updates.count} available` : undefined
          }
          action={
            updates.wudUrl ? (
              <a
                href={updates.wudUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:text-fg"
              >
                Open in WUD <ExternalLink className="h-3 w-3" />
              </a>
            ) : undefined
          }
        />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <StatusPill health={updates.health} label={updates.detail} />
          {updates.fetchedAt ? (
            <span className="text-2xs text-faint">
              Detected {formatDateTime(updates.fetchedAt)}
            </span>
          ) : null}
        </div>
      </Card>

      <Card>
        <CardHeader title="Containers" hint={`${pending.length} listed`} />
        {loading && !hasData ? (
          <div className="space-y-2 px-4 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : updates.health === "unknown" ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            {updates.detail === "Not configured"
              ? "WUD not configured"
              : "WUD unavailable"}
          </div>
        ) : pending.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted">
            No updates available
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[480px] divide-y divide-line">
              <div className="grid grid-cols-3 gap-3 px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted">
                <span>Container</span>
                <span>Current</span>
                <span>Available</span>
              </div>
              {pending.map((u) => (
                <div
                  key={u.containerId}
                  className="grid grid-cols-3 gap-3 px-4 py-2.5 text-sm hover:bg-surface-2/50"
                >
                  <span className="truncate text-fg">{u.containerName}</span>
                  <span className="truncate font-mono text-muted">
                    {u.currentVersion ?? "—"}
                  </span>
                  <span className="truncate font-mono text-degraded">
                    {u.availableVersion ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
