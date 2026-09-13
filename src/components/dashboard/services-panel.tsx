import { ExternalLink } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UpdatedHint } from "@/components/ui/updated-hint";
import { StatusDot } from "@/components/ui/status-dot";
import {
  SERVICE_HEALTH_TEXT,
  serviceHealthToIntegration,
} from "@/lib/health";
import type { ServiceRow } from "@/lib/integrations/services/types";
import type { PolledMeta } from "@/hooks/use-polled";

interface ServicesPanelProps {
  services: ServiceRow[];
  meta: PolledMeta;
}

export function ServicesPanel({ services, meta }: ServicesPanelProps) {
  const { loading, error, stale, lastSuccessAt } = meta;

  if (loading) {
    return (
      <Card>
        <CardHeader title="Services" />
        <div className="divide-y divide-line">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-2.5">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="ml-auto h-3 w-20" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (error && lastSuccessAt === null) {
    return (
      <Card>
        <CardHeader title="Services" />
        <div className="px-4 py-3 text-sm text-muted">
          Unavailable — retrying
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Services"
        hint={
          <>
            {`${services.length} checked`}
            <UpdatedHint
              lastSuccessAt={lastSuccessAt}
              stale={stale}
              className="ml-2"
            />
          </>
        }
      />
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
              <StatusDot
                health={serviceHealthToIntegration(service.health)}
                label={SERVICE_HEALTH_TEXT[service.health]}
                pulse={
                  service.health === "offline" || service.health === "degraded"
                }
              />
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
