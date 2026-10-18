"use client";

import { useState } from "react";
import Image from "next/image";
import { Film, Monitor } from "lucide-react";
import { ProgressBar } from "@/components/ui/metric";
import {
  buildTvContext,
  formatPlaybackTime,
  jellyfinMethodLabel,
  progressPercent,
} from "@/lib/jellyfin-display";
import type { JellyfinSession } from "@/lib/integrations/jellyfin/types";
import { JellyfinDetails } from "./jellyfin-details";

interface JellyfinSessionCardProps {
  session: JellyfinSession;
  showPosters: boolean;
}

function clientDeviceLabel(session: JellyfinSession): string {
  const parts = [session.client, session.device].filter((part): part is string => part !== null && part !== undefined && part !== "");
  return parts.join(" · ");
}

function stateBadge(state: JellyfinSession["state"]): { label: string; color: string } {
  switch (state) {
    case "playing":
      return { label: "Playing", color: "text-healthy" };
    case "paused":
      return { label: "Paused", color: "text-degraded" };
    case "idle":
      return { label: "Idle", color: "text-faint" };
  }
}

function PosterFallback({ hasMedia }: { hasMedia: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center">
      {hasMedia ? <Film className="h-5 w-5" aria-hidden /> : <Monitor className="h-5 w-5" aria-hidden />}
    </div>
  );
}

function SessionPoster({ src, hasMedia }: { src: string; hasMedia: boolean }) {
  const [errored, setErrored] = useState(false);
  if (errored) return <PosterFallback hasMedia={hasMedia} />;
  return (
    <Image
      src={src}
      alt=""
      fill
      unoptimized
      className="object-cover"
      onError={() => setErrored(true)}
    />
  );
}

export function JellyfinSessionCard({ session, showPosters }: JellyfinSessionCardProps) {
  const { state, media, playback } = session;
  const isPlayback = state === "playing" || state === "paused";
  const badge = stateBadge(state);

  const title = isPlayback ? (media.title ?? "Unavailable") : session.user;
  const tvContext = buildTvContext(media);
  const secondaryParts = isPlayback
    ? [tvContext, session.user, clientDeviceLabel(session)].filter((part): part is string => part !== null && part !== undefined && part !== "")
    : [clientDeviceLabel(session)].filter((part): part is string => part !== null && part !== undefined && part !== "");
  const secondary = secondaryParts.length > 0 ? secondaryParts.join(" · ") : "—";

  const percent = progressPercent(media.positionSeconds, media.durationSeconds);
  const showTime =
    media.positionSeconds !== null || media.durationSeconds !== null;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      {showPosters ? (
        <div className="relative aspect-[2/3] w-14 shrink-0 overflow-hidden rounded bg-surface-3 text-faint">
          {media.posterUrl !== null ? (
            <SessionPoster
              key={media.posterUrl}
              src={media.posterUrl}
              hasMedia={media.id !== null}
            />
          ) : (
            <PosterFallback hasMedia={media.id !== null} />
          )}
        </div>
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span
            className="min-w-0 truncate text-sm text-fg"
            title={title}
          >
            {title}
          </span>
          <span
            className={`shrink-0 text-2xs font-medium uppercase tracking-wider ${badge.color}`}
          >
            {badge.label}
          </span>
        </div>

        <div
          className="mt-0.5 truncate text-2xs text-muted"
          title={secondary}
        >
          {secondary}
        </div>

        {isPlayback ? (
          <>
            <div className="mt-2 flex items-center gap-3">
              {percent !== null ? (
                <div className="flex-1">
                  <ProgressBar percent={percent} tone="accent" />
                </div>
              ) : null}
              {showTime ? (
                <span className="shrink-0 text-2xs text-faint">
                  {media.durationSeconds !== null
                    ? `${formatPlaybackTime(media.positionSeconds)} / ${formatPlaybackTime(media.durationSeconds)}`
                    : formatPlaybackTime(media.positionSeconds)}
                </span>
              ) : null}
              <span className="shrink-0 text-2xs text-faint">
                {jellyfinMethodLabel(session.playback.method)}
              </span>
            </div>
            <JellyfinDetails playback={playback} />
          </>
        ) : null}
      </div>
    </div>
  );
}
