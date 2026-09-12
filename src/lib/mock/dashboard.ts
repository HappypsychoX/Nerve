import type { AttentionItem, SystemStatusRow } from "@/types";

// Not-implemented integrations (M3/M4/M5). Honest "unknown" state per §17.
export const placeholderSystemRows: SystemStatusRow[] = [
  { id: "backup", label: "Backup", health: "unknown", detail: "—" },
  { id: "vpn", label: "VPN", health: "unknown", detail: "—" },
  { id: "updates", label: "Updates", health: "unknown", detail: "—" },
];

// WUD update attention items arrive in M3. Empty until then.
export const attentionItems: AttentionItem[] = [];
