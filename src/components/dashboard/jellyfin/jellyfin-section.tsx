"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill } from "@/components/ui/status-dot";
import { UpdatedHint } from "@/components/ui/updated-hint";
import { JellyfinSummary } from "@/components/dashboard/jellyfin/jellyfin-summary";
import { JellyfinSessionCard } from "@/components/dashboard/jellyfin/jellyfin-session";
import { useJellyfin } from "@/hooks/use-jellyfin";
import {
  groupJellyfinSessions,
  JELLYFIN_STATUS_HEALTH,
  JELLYFIN_STATUS_LABEL,
} from "@/lib/jellyfin-display";
import type { JellyfinDisplayConfig } from "@/lib/config";
import type { JellyfinStatus } from "@/lib/integrations/jellyfin/types";

const TERMINAL_MESSAGES: Partial<Record<JellyfinStatus, string>> = {
  unauthorized: "Jellyfin API key was rejected. Check JELLYFIN_API_KEY.",
  offline: "Jellyfin is offline or unreachable.",
  error: "Jellyfin returned an unexpected response.",
};

export function JellyfinSection({ config }: { config: JellyfinDisplayConfig }) {
  const { status, snapshot, loading, lastSuccessAt, stale } = useJellyfin(config.enabled);
  const [expanded, setExpanded] = useState(false);
  const panelId = "jellyfin-sessions-panel";

  let body: ReactNode;

  if (loading) {
    body = (
      <div className="space-y-4 px-4 py-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  } else if (status === "disabled") {
    body = (
      <div className="px-4 py-3 text-sm text-muted">
        Jellyfin monitoring is disabled. Enable it in{" "}
        <span className="font-mono">config/nerve.yaml</span> (jellyfin.enabled) and restart Nerve.
      </div>
    );
  } else if (status === "unconfigured") {
    body = (
      <div className="px-4 py-3 text-sm text-muted">
        Jellyfin is not configured. Set <span className="font-mono">JELLYFIN_URL</span> and{" "}
        <span className="font-mono">JELLYFIN_API_KEY</span> and restart Nerve.
      </div>
    );
  } else if (snapshot === null) {
    const message = status !== null ? (TERMINAL_MESSAGES[status] ?? "Unavailable — retrying") : "Unavailable — retrying";
    body = <div className="px-4 py-3 text-sm text-muted">{message}</div>;
  } else {
    const groups = groupJellyfinSessions(snapshot.sessions);
    const visibleSessions = [
      ...groups.playing,
      ...groups.paused,
      ...(config.showIdleClients ? groups.idle : []),
    ];

    body = (
      <>
        {status !== null && status !== "online" ? (
          <div className="border-b border-line bg-surface-2 px-4 py-2 text-2xs text-degraded">
            {JELLYFIN_STATUS_LABEL[status]} — showing last known activity
          </div>
        ) : null}

        <JellyfinSummary counts={snapshot.counts} />

        <div
          id={panelId}
          hidden={!expanded}
          className="divide-y divide-line border-t border-line"
        >
          {snapshot.sessions.length === 0 && status === "online" ? (
            <div className="px-4 py-3 text-sm text-muted">
              Nothing currently playing
            </div>
          ) : (
            visibleSessions.map((session, index) => (
              <JellyfinSessionCard
                key={session.id ?? `${session.user}-${index}`}
                session={session}
                showPosters={config.showPosters}
              />
            ))
          )}
        </div>
      </>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Jellyfin"
        hint={lastSuccessAt != null ? <UpdatedHint lastSuccessAt={lastSuccessAt} stale={stale} /> : undefined}
        action={
          <div className="flex items-center gap-3">
            {status !== null ? (
              <StatusPill health={JELLYFIN_STATUS_HEALTH[status]} label={JELLYFIN_STATUS_LABEL[status]} />
            ) : (
              <span className="text-xs text-muted">Checking…</span>
            )}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-controls={panelId}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")}
                aria-hidden
              />
              <span className="sr-only">
                {expanded ? "Collapse Jellyfin sessions" : "Expand Jellyfin sessions"}
              </span>
            </button>
          </div>
        }
      />
      {body}
    </Card>
  );
}
