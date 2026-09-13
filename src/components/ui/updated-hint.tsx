"use client";

import { useEffect, useState } from "react";
import { cn, formatRelative } from "@/lib/utils";

export function UpdatedHint({
  lastSuccessAt,
  stale,
  className,
}: {
  lastSuccessAt: number | null;
  stale?: boolean;
  className?: string;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(timer);
  }, []);

  if (lastSuccessAt === null || now === null) return null;

  return (
    <span
      className={cn(
        "text-2xs",
        stale ? "text-degraded" : "text-faint",
        className,
      )}
      title={new Date(lastSuccessAt).toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    >
      {stale ? "Stale · " : ""}
      updated {formatRelative(lastSuccessAt, now)}
    </span>
  );
}
