import { AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import type { AttentionItem, AttentionSeverity, IntegrationHealth } from "@/types";

const SEVERITY_TEXT: Record<AttentionSeverity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
};

const SEVERITY_DOT_HEALTH: Record<AttentionSeverity, IntegrationHealth> = {
  critical: "offline",
  warning: "degraded",
  info: "unknown",
};

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Attention"
        hint={`${items.length}`}
        action={<AlertTriangle className="h-4 w-4 text-degraded" />}
      />
      <div className="flex-1 divide-y divide-line">
        {items.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted">
            Nothing needs attention
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="flex items-center gap-2">
                <StatusDot
                  health={SEVERITY_DOT_HEALTH[item.severity]}
                  label={SEVERITY_TEXT[item.severity]}
                  pulse={
                    item.severity === "critical" || item.severity === "warning"
                  }
                />
                <span className="text-sm text-fg">{item.label}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs font-medium uppercase tracking-wider text-faint">
                  {SEVERITY_TEXT[item.severity]}
                </span>
                <span className="truncate text-xs text-degraded">
                  {item.detail}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
