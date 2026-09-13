import type { SystemStatusRow } from "@/types";

// Not-implemented integrations (M5). Honest "unknown" state per §17.
export const placeholderSystemRows: SystemStatusRow[] = [
  { id: "vpn", label: "VPN", health: "unknown", detail: "—" },
];
