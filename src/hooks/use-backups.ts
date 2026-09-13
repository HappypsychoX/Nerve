"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type { BackupsResponse } from "@/lib/integrations/backup/types";
import type { PolledMeta } from "@/hooks/use-polled";

export const BACKUP_POLL_INTERVAL_MS = 30000;

export function useBackups(): BackupsResponse & PolledMeta {
  const { backups } = useDashboard();
  return {
    ...backups.data,
    loading: backups.loading,
    error: backups.error,
    lastSuccessAt: backups.lastSuccessAt,
    stale: backups.stale,
  };
}
