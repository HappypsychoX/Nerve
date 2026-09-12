"use client";

import { useEffect, useState } from "react";

function useNow(intervalMs = 1000): string {
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const update = () =>
      setNow(
        new Date().toLocaleTimeString(undefined, {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    update();
    const timer = setInterval(update, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

export function Clock() {
  const now = useNow();
  return (
    <span className="font-mono text-xs tabular-nums text-muted">
      {now || "--:--:--"}
    </span>
  );
}
