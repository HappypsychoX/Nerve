"use client";

import { useEffect, useState } from "react";

export interface PolledMeta {
  loading: boolean;
  error: boolean;
  lastSuccessAt: number | null;
  stale: boolean;
}

export interface PolledResult<T> extends PolledMeta {
  data: T;
}

export function usePolled<T>(
  url: string,
  intervalMs: number,
  initial: T,
  opts?: { staleAfterMs?: number },
): PolledResult<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [stale, setStale] = useState<boolean>(false);
  const staleAfterMs = opts?.staleAfterMs ?? intervalMs * 3;

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const tick = async () => {
      try {
        const res = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          if (active) setError(true);
          return;
        }
        const json = (await res.json()) as T;
        if (!active) return;
        setData(json);
        setError(false);
        const now = Date.now();
        setLastSuccessAt(now);
        setStale(false);
      } catch {
        if (active) setError(true);
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

  useEffect(() => {
    if (lastSuccessAt === null) return;
    const check = () => setStale(Date.now() - lastSuccessAt > staleAfterMs);
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [lastSuccessAt, staleAfterMs]);

  return { data, loading, error, lastSuccessAt, stale };
}
