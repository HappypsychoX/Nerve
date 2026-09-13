"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type { WudUpdatesResponse } from "@/lib/integrations/wud/types";
import type { PolledMeta } from "@/hooks/use-polled";

export const UPDATES_POLL_INTERVAL_MS = 60000;

export function useUpdates(): WudUpdatesResponse & PolledMeta {
  const { updates } = useDashboard();
  return {
    ...updates.data,
    loading: updates.loading,
    error: updates.error,
    lastSuccessAt: updates.lastSuccessAt,
    stale: updates.stale,
  };
}
