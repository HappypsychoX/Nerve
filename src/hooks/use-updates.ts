"use client";

import { useEffect, useState } from "react";
import type { WudUpdatesResponse } from "@/lib/integrations/wud/types";

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

export const UPDATES_POLL_INTERVAL_MS = 60000;

export function useUpdates(
  intervalMs = UPDATES_POLL_INTERVAL_MS,
): WudUpdatesResponse & { loading: boolean } {
  const initial: WudUpdatesResponse = {
    health: "unknown",
    detail: "Checking…",
    updates: [],
    count: 0,
    total: 0,
    fetchedAt: null,
    wudUrl: null,
  };
  const { data, loading } = usePolled<WudUpdatesResponse>(
    "/api/wud/updates",
    intervalMs,
    initial,
  );
  return { ...data, loading };
}
