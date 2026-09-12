import { ExternalLink } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import type { ServiceConfig } from "@/lib/config";

export function QuickAccess({ links }: { links: ServiceConfig[] }) {
  return (
    <Card>
      <CardHeader title="Quick Access" hint={`${links.length}`} />
      <div className="flex flex-wrap gap-2 px-4 py-3.5">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-xs text-muted transition-colors hover:border-line-strong hover:text-fg"
          >
            <span>{link.name}</span>
            <ExternalLink className="h-3 w-3 text-faint" />
          </a>
        ))}
      </div>
    </Card>
  );
}
