import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdatedHint } from "@/components/ui/updated-hint";
import { StatusDot } from "@/components/ui/status-dot";
import { formatBytes, formatUptime } from "@/lib/utils";
import {
  containerDisplayStatus,
  containerStateLabel,
} from "@/lib/health";
import { matchUpdateForContainer } from "@/lib/config/matching";
import type { ContainerRow } from "@/lib/integrations/docker/types";
import type {
  ContainerHealth,
  ContainerState,
  ContainerUpdate,
  IntegrationHealth,
} from "@/types";
import type { PolledMeta } from "@/hooks/use-polled";

interface ContainersPreviewProps extends PolledMeta {
  containers: ContainerRow[];
  dockerHealth: IntegrationHealth;
  updates: ContainerUpdate[];
}

function containerRank(state: ContainerState, health: ContainerHealth): number {
  if (health === "unhealthy") return 0;
  if (state === "stopped") return 1;
  if (state === "restarting") return 2;
  if (state === "running") return 3;
  return 4;
}

function sortContainers(containers: ContainerRow[]): ContainerRow[] {
  return [...containers].sort((a, b) => {
    const rankDiff = containerRank(a.state, a.health) - containerRank(b.state, b.health);
    if (rankDiff !== 0) return rankDiff;
    return a.name.localeCompare(b.name);
  });
}

export function ContainersPreview({
  containers,
  loading,
  error,
  stale,
  lastSuccessAt,
  dockerHealth,
  updates,
}: ContainersPreviewProps) {
  const sorted = sortContainers(containers).slice(0, 8);
  const total = containers.length;
  const hint = total <= 8 ? `${total} listed` : `8 of ${total} listed`;
  const offline = dockerHealth === "offline";
  const unreachable = offline || (error && containers.length === 0);
  const empty = !loading && !unreachable && containers.length === 0;

  return (
    <Card>
      <CardHeader
        title="Containers"
        hint={
          loading ? undefined : (
            <>
              {hint}
              <UpdatedHint
                lastSuccessAt={lastSuccessAt}
                stale={stale}
                className="ml-2"
              />
            </>
          )
        }
        action={
          <Link
            href="/containers"
            className="text-xs font-medium text-accent hover:text-accent-strong"
          >
            View all
          </Link>
        }
      />
      <div className="divide-y divide-line">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="ml-auto h-3 w-14" />
              <Skeleton className="hidden h-3 w-20 sm:block" />
              <Skeleton className="hidden h-3 w-20 md:block" />
            </div>
          ))
        ) : unreachable ? (
          <div className="px-4 py-3 text-sm text-muted">
            Docker unreachable
            {containers.length > 0 ? (
              <span className="ml-2 text-2xs text-degraded">
                Showing last known data
              </span>
            ) : null}
          </div>
        ) : empty ? (
          <div className="px-4 py-3 text-sm text-muted">
            No containers running
          </div>
        ) : (
          sorted.map((row) => {
            const health = containerDisplayStatus(row.state, row.health);
            const update = matchUpdateForContainer(updates, row.name);
            return (
              <div
                key={row.id}
                className="flex items-center gap-4 px-4 py-2.5"
              >
                <StatusDot
                  health={health}
                  label={containerStateLabel(row.state, row.health)}
                  pulse={health === "degraded" || health === "offline"}
                />
                <div className="w-36 min-w-0 truncate text-sm text-fg">
                  {row.name}
                </div>
                <div className="w-20 shrink-0 text-xs text-muted">
                  {containerStateLabel(row.state, row.health)}
                </div>
                <div className="w-14 shrink-0 text-right font-mono text-xs text-muted">
                  {row.cpuPercent === null
                    ? "—"
                    : `${row.cpuPercent.toFixed(1)}%`}
                </div>
                <div className="hidden w-20 shrink-0 text-right font-mono text-xs text-muted sm:block">
                  {formatBytes(row.memoryBytes)}
                </div>
                <div className="hidden w-20 shrink-0 text-right font-mono text-xs text-faint md:block">
                  {formatUptime(row.uptimeSeconds)}
                </div>
                <div className="w-16 shrink-0 text-right text-xs">
                  {update?.updateAvailable ? (
                    <span
                      className="text-degraded"
                      title={`${update.currentVersion ?? "?"} → ${update.availableVersion ?? "?"}`}
                    >
                      Update
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}
