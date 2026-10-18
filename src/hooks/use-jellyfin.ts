"use client";

import { useEffect, useState } from "react";
import type {
  JellyfinCounts,
  JellyfinSession,
  JellyfinSessionsResponse,
  JellyfinStatus,
} from "@/lib/integrations/jellyfin/types";
import { EMPTY_JELLYFIN_COUNTS } from "@/lib/jellyfin-display";

export const JELLYFIN_POLL_INTERVAL_MS = 10000;
const JELLYFIN_STALE_AFTER_MS = JELLYFIN_POLL_INTERVAL_MS * 3;

export interface JellyfinSnapshot {
  sessions: JellyfinSession[];
  counts: JellyfinCounts;
  observedAt: string | null;
}

export interface JellyfinPollResult {
  status: JellyfinStatus | null;
  snapshot: JellyfinSnapshot | null;
  loading: boolean;
  error: boolean;
  lastSuccessAt: number | null;
  stale: boolean;
}

export function useJellyfin(enabled: boolean): JellyfinPollResult {
  const [status, setStatus] = useState<JellyfinStatus | null>(enabled ? null : "disabled");
  const [snapshot, setSnapshot] = useState<JellyfinSnapshot | null>(null);
  const [loading, setLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<boolean>(false);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [stale, setStale] = useState<boolean>(false);

  useEffect(() => {
    let active = true;

    if (!enabled) {
      setLoading(false);
      setStatus("disabled");
      return;
    }

    const controller = new AbortController();
    // Per-effect-instance in-flight flag (see use-polled.ts).
    let inFlight = false;

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;

      try {
        const res = await fetch("/api/jellyfin/sessions", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) {
          if (active) setError(true);
          return;
        }

        const json = (await res.json()) as JellyfinSessionsResponse;
        if (!active) return;

        setError(false);
        const nextStatus: JellyfinStatus = json.status ?? "error";
        setStatus(nextStatus);

        if (nextStatus === "online") {
          setSnapshot({
            sessions: json.sessions ?? [],
            counts: json.counts ?? { ...EMPTY_JELLYFIN_COUNTS },
            observedAt: json.observedAt ?? null,
          });
          setLastSuccessAt(Date.now());
          setStale(false);
        }
      } catch {
        if (active) setError(true);
      } finally {
        inFlight = false;
        if (active) setLoading(false);
      }
    };

    tick();
    const timer = setInterval(tick, JELLYFIN_POLL_INTERVAL_MS);

    return () => {
      active = false;
      controller.abort();
      clearInterval(timer);
    };
  }, [enabled]);

  useEffect(() => {
    if (lastSuccessAt === null) return;
    const check = () => setStale(Date.now() - lastSuccessAt > JELLYFIN_STALE_AFTER_MS);
    check();
    const timer = setInterval(check, 5000);
    return () => clearInterval(timer);
  }, [lastSuccessAt]);

  return { status, snapshot, loading, error, lastSuccessAt, stale };
}
