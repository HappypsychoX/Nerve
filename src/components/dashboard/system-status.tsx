import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { HEALTH_TEXT } from "@/lib/health";
import type { SystemStatusRow } from "@/types";

export function SystemStatus({ rows }: { rows: SystemStatusRow[] }) {
  return (
    <Card>
      <CardHeader title="System" />
      <div className="grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-5">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center gap-3 bg-surface px-4 py-3.5"
          >
            <StatusDot
              health={row.health}
              label={HEALTH_TEXT[row.health]}
              pulse={row.health === "degraded" || row.health === "offline"}
            />
            <div className="min-w-0">
              <div className="text-xs font-medium text-fg">{row.label}</div>
              <div className="truncate text-xs text-muted">{row.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
