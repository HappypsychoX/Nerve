import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { formatBytes, formatUptime } from "@/lib/utils";
import {
  containerDisplayStatus,
  containerStateLabel,
} from "@/lib/health";
import type { ContainerStatus } from "@/types";

export function ContainersPreview({
  containers,
}: {
  containers: ContainerStatus[];
}) {
  return (
    <Card>
      <CardHeader
        title="Containers"
        hint={`${containers.length} listed`}
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
        {containers.map((container) => {
          const health = containerDisplayStatus(
            container.state,
            container.health,
          );
          return (
            <div
              key={container.id}
              className="flex items-center gap-4 px-4 py-2.5"
            >
              <StatusDot health={health} />
              <div className="w-36 min-w-0 truncate text-sm text-fg">
                {container.name}
              </div>
              <div className="w-20 shrink-0 text-xs text-muted">
                {containerStateLabel(container.state, container.health)}
              </div>
              <div className="w-14 shrink-0 text-right font-mono text-xs text-muted">
                {container.cpuPercent === null
                  ? "—"
                  : `${container.cpuPercent.toFixed(1)}%`}
              </div>
              <div className="hidden w-20 shrink-0 text-right font-mono text-xs text-muted sm:block">
                {formatBytes(container.memoryBytes)}
              </div>
              <div className="hidden w-20 shrink-0 text-right font-mono text-xs text-faint md:block">
                {formatUptime(container.uptimeSeconds)}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
