import { AlertTriangle } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import type { AttentionItem } from "@/lib/mock/dashboard";

export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Attention"
        hint={`${items.length}`}
        action={<AlertTriangle className="h-4 w-4 text-degraded" />}
      />
      <div className="flex-1 divide-y divide-line">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-3 px-4 py-2.5"
          >
            <span className="text-sm text-fg">{item.label}</span>
            <span className="truncate text-xs text-degraded">{item.detail}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}
