"use client";

import { useEffect, useState } from "react";
import type { VpnStatusResponse } from "@/lib/integrations/gluetun/types";

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

export const VPN_POLL_INTERVAL_MS = 30000;

export function useVpn(
  intervalMs = VPN_POLL_INTERVAL_MS,
): VpnStatusResponse & { loading: boolean } {
  const initial: VpnStatusResponse = {
    health: "unknown",
    detail: "Checking…",
    status: {
      state: "unknown",
      publicIp: null,
      containerHealthy: null,
      containerState: null,
      containerHealth: null,
    },
    fetchedAt: null,
  };
  const { data, loading } = usePolled<VpnStatusResponse>(
    "/api/gluetun/status",
    intervalMs,
    initial,
  );
  return { ...data, loading };
}
