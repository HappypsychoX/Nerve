"use client";

import { useEffect, useState } from "react";
import type { BackupsResponse } from "@/lib/integrations/backup/types";

function usePolled<T>(
  url: string,
  intervalMs: number,
  initial: T,
): { data: T; loading: boolean } {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as T;
        if (active) setData(json);
      } catch {
        // keep previous data on failure; do not flip to offline
      } finally {
        if (active) setLoading(false);
      }
    };

    tick();
    const timer = setInterval(tick, intervalMs);

    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [url, intervalMs]);

  return { data, loading };
}

export const BACKUP_POLL_INTERVAL_MS = 30000;

export function useBackups(
  intervalMs = BACKUP_POLL_INTERVAL_MS,
): BackupsResponse & { loading: boolean } {
  const initial: BackupsResponse = {
    latest: null,
    runs: [],
    containerStatus: { running: false, names: [] },
    health: "unknown",
    detail: "Checking…",
    dbError: null,
  };
  const { data, loading } = usePolled<BackupsResponse>(
    "/api/backups",
    intervalMs,
    initial,
  );
  return { ...data, loading };
}
