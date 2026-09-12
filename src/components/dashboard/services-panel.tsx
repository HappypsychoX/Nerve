import { ExternalLink } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import {
  SERVICE_HEALTH_TEXT,
  serviceHealthToIntegration,
} from "@/lib/health";
import type { ServiceRow } from "@/lib/integrations/services/types";

export function ServicesPanel({ services }: { services: ServiceRow[] }) {
  return (
    <Card>
      <CardHeader title="Services" hint={`${services.length} checked`} />
      <div className="divide-y divide-line">
        {services.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted">
            No services configured
          </div>
        ) : (
          services.map((service) => (
            <div
              key={service.id}
              className="flex items-center gap-4 px-4 py-2.5"
            >
              <StatusDot health={serviceHealthToIntegration(service.health)} />
              <div className="min-w-0 flex-1 truncate text-sm text-fg">
                {service.name}
              </div>
              <div className="shrink-0 text-xs text-muted">
                {SERVICE_HEALTH_TEXT[service.health]}
              </div>
              {service.detail && service.health !== "unknown" ? (
                <div className="shrink-0 text-xs text-faint">
                  {service.detail}
                </div>
              ) : null}
              {service.url ? (
                <a
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-faint hover:text-fg"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
