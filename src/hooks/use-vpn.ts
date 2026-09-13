"use client";

import { useDashboard } from "@/components/dashboard/dashboard-provider";
import type { VpnStatusResponse } from "@/lib/integrations/gluetun/types";
import type { PolledMeta } from "@/hooks/use-polled";

export const VPN_POLL_INTERVAL_MS = 30000;

export function useVpn(): VpnStatusResponse & PolledMeta {
  const { vpn } = useDashboard();
  return {
    ...vpn.data,
    loading: vpn.loading,
    error: vpn.error,
    lastSuccessAt: vpn.lastSuccessAt,
    stale: vpn.stale,
  };
}
