import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import type { SystemStatusRow } from "@/lib/mock/dashboard";

export function SystemStatus({ rows }: { rows: SystemStatusRow[] }) {
  return (
    <Card>
      <CardHeader title="System" />
      <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-3.5">
            <StatusDot health={row.health} />
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
