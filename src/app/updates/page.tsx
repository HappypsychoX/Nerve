import { RefreshCw } from "lucide-react";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export default function UpdatesPage() {
  return (
    <PlaceholderPage
      icon={RefreshCw}
      title="Updates"
      description="A clean WUD summary: available update count, affected containers, current and available versions, with a link to open WUD. Nerve only reports."
      milestone="Milestone 3 — WUD Integration"
    />
  );
}
