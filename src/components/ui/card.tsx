import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-panel border border-line bg-surface shadow-panel",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  hint,
  action,
  className,
}: {
  title: string;
  hint?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex items-center justify-between gap-3 border-b border-line px-4 py-3",
        className,
      )}
    >
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
          {title}
        </h2>
        {hint ? <span className="text-2xs text-faint">{hint}</span> : null}
      </div>
      {action}
    </header>
  );
}
