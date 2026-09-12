import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function PlaceholderPage({
  icon: Icon,
  title,
  description,
  milestone,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  milestone?: string;
  className?: string;
}) {
  return (
    <Card className={cn("max-w-2xl", className)}>
      <div className="grid-bg px-6 py-12">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line-strong bg-surface-3">
          <Icon className="h-5 w-5 text-accent" />
        </div>
        <h2 className="mt-5 text-lg font-semibold tracking-tight text-fg">
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          {description}
        </p>
        {milestone ? (
          <p className="mt-6 inline-flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-2xs text-faint">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-unknown" />
            Planned for {milestone}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
