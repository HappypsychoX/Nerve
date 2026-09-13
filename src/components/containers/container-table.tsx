import type { ServiceGroupConfig } from "@/lib/config";
import type { ContainerRow } from "@/lib/integrations/docker/types";
import type { ContainerUpdate, IntegrationHealth } from "@/types";
import { containerDisplayStatus, containerStateLabel } from "@/lib/health";
import { matchUpdateForContainer } from "@/lib/config/matching";
import { formatBytes, formatUptime } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { Skeleton } from "@/components/ui/skeleton";

export function ContainerTable({
  rows,
  groups,
  health,
  loading,
  updates,
  query,
  group,
  status,
  onQueryChange,
  onGroupChange,
  onStatusChange,
}: {
  rows: ContainerRow[];
  groups: ServiceGroupConfig[];
  health: IntegrationHealth;
  loading: boolean;
  updates: ContainerUpdate[];
  query: string;
  group: string;
  status: string;
  onQueryChange: (value: string) => void;
  onGroupChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}) {
  const groupName = (id: string) =>
    groups.find((g) => g.id === id)?.name ?? id;

  return (
    <Card>
      <CardHeader title="Containers" hint={`${rows.length} listed`} />

      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search name or image"
          className="w-56 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-fg placeholder:text-faint focus:border-line-strong focus:outline-none"
        />
        <select
          value={group}
          onChange={(e) => onGroupChange(e.target.value)}
          className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-fg focus:border-line-strong focus:outline-none"
        >
          <option value="all">All groups</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
          className="rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs text-fg focus:border-line-strong focus:outline-none"
        >
          <option value="all">All</option>
          <option value="running">Running</option>
          <option value="stopped">Stopped</option>
          <option value="restarting">Restarting</option>
          <option value="unhealthy">Unhealthy</option>
        </select>
      </div>

      {health === "offline" ? (
        <div className="border-b border-line px-4 py-2.5 text-xs text-offline">
          Docker unreachable
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-2xs uppercase tracking-[0.12em] text-faint">
              <th className="px-4 py-2.5 font-medium">Container</th>
              <th className="px-4 py-2.5 font-medium">State</th>
              <th className="px-4 py-2.5 font-medium">Group</th>
              <th className="px-4 py-2.5 font-medium">Image</th>
              <th className="px-4 py-2.5 font-medium">Uptime</th>
              <th className="px-4 py-2.5 text-right font-medium">CPU</th>
              <th className="px-4 py-2.5 text-right font-medium">Memory</th>
              <th className="px-4 py-2.5 text-right font-medium">Restarts</th>
              <th className="px-4 py-2.5 text-right font-medium">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
                      <Skeleton className="h-4 w-36" />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Skeleton className="h-4 w-16" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Skeleton className="h-4 w-12" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Skeleton className="ml-auto h-4 w-10" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Skeleton className="ml-auto h-4 w-12" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Skeleton className="ml-auto h-4 w-8" />
                  </td>
                  <td className="px-4 py-2.5">
                    <Skeleton className="ml-auto h-4 w-12" />
                  </td>
                </tr>
              ))
            ) : health === "healthy" && rows.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-sm text-muted"
                >
                  No containers match
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const update = matchUpdateForContainer(updates, row.name);
                return (
                  <tr key={row.id} className="hover:bg-surface-2/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <StatusDot
                          health={containerDisplayStatus(row.state, row.health)}
                          label={containerStateLabel(row.state, row.health)}
                          pulse={
                            row.state === "restarting" ||
                            row.health === "unhealthy" ||
                            row.state === "stopped"
                          }
                        />
                        <span className="font-medium text-fg">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {containerStateLabel(row.state, row.health)}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted">
                      {groupName(row.group)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">
                      {row.image}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted">
                      {formatUptime(row.uptimeSeconds)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-muted">
                      {row.cpuPercent === null
                        ? "—"
                        : `${row.cpuPercent.toFixed(1)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-muted">
                      {formatBytes(row.memoryBytes)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-xs text-muted">
                      {row.restartCount}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs">
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
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
