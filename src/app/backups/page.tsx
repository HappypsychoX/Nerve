import { Archive } from "lucide-react";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export default function BackupsPage() {
  return (
    <PlaceholderPage
      icon={Archive}
      title="Backups"
      description="Offen backup results collected via webhook: latest success or failure, timestamps, size, duration, local and R2/S3 status, and recent history."
      milestone="Milestone 4 — Backup Integration"
    />
  );
}
