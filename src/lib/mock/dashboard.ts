import type { SystemStatusRow } from "@/types";

// Not-implemented integrations (M4/M5). Honest "unknown" state per §17.
export const placeholderSystemRows: SystemStatusRow[] = [
  { id: "backup", label: "Backup", health: "unknown", detail: "—" },
  { id: "vpn", label: "VPN", health: "unknown", detail: "—" },
];
