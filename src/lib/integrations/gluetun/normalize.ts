import type { VpnState } from "@/types";
import type { GluetunPublicIpPayload, GluetunVpnStatusPayload } from "./types";

export function parseVpnState(payload: unknown): VpnState {
  const status = (payload as GluetunVpnStatusPayload | null)?.status;
  if (status === "running") return "running";
  if (status === "stopped") return "stopped";
  return "unknown";
}

export function parsePublicIp(payload: unknown): string | null {
  const p = payload as GluetunPublicIpPayload | null;
  if (p && typeof p.public_ip === "string" && p.public_ip.trim()) {
    return p.public_ip.trim();
  }
  if (p && typeof p.ip === "string" && p.ip.trim()) {
    return p.ip.trim();
  }
  return null;
}
