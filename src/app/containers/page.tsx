import { Boxes } from "lucide-react";
import { PlaceholderPage } from "@/components/ui/placeholder-page";

export default function ContainersPage() {
  return (
    <PlaceholderPage
      icon={Boxes}
      title="Containers"
      description="A detailed Docker view: searchable container list, group and status filters, health, image, uptime, CPU, memory, and restart counts. Read-only by design."
      milestone="Milestone 1 — Docker Integration"
    />
  );
}
