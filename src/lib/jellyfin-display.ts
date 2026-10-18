import type {
  JellyfinCounts,
  JellyfinMedia,
  JellyfinPlayMethod,
  JellyfinPlayback,
  JellyfinSession,
  JellyfinStatus,
} from "@/lib/integrations/jellyfin/types";
import type { IntegrationHealth } from "@/types";

export const JELLYFIN_STATUS_LABEL: Record<JellyfinStatus, string> = {
  online: "Online",
  offline: "Offline",
  unauthorized: "Unauthorized",
  unconfigured: "Not configured",
  disabled: "Disabled",
  error: "Error",
};

export const JELLYFIN_STATUS_HEALTH: Record<JellyfinStatus, IntegrationHealth> = {
  online: "healthy",
  offline: "offline",
  unauthorized: "degraded",
  unconfigured: "unknown",
  disabled: "unknown",
  error: "degraded",
};

export const EMPTY_JELLYFIN_COUNTS: JellyfinCounts = {
  playing: 0,
  paused: 0,
  idle: 0,
  transcoding: 0,
};

export function jellyfinMethodLabel(method: JellyfinPlayMethod): string {
  switch (method) {
    case "directPlay":
      return "Direct play";
    case "directStream":
      return "Direct stream";
    case "transcode":
      return "Transcoding";
    default:
      return "—";
  }
}

export function progressPercent(
  positionSeconds: number | null,
  durationSeconds: number | null,
): number | null {
  if (positionSeconds === null || positionSeconds === undefined) return null;
  if (durationSeconds === null || durationSeconds === undefined) return null;
  if (!Number.isFinite(positionSeconds) || !Number.isFinite(durationSeconds)) return null;
  if (durationSeconds <= 0) return null;

  const percent = (positionSeconds / durationSeconds) * 100;
  if (!Number.isFinite(percent)) return null;
  return Math.max(0, Math.min(100, percent));
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatPlaybackTime(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "—";
  if (!Number.isFinite(seconds) || seconds < 0) return "—";

  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${pad2(m)}:${pad2(s)}`;
  }
  return `${m}:${pad2(s)}`;
}

export function buildTvContext(media: JellyfinMedia): string | null {
  if (media.series === null || media.series === undefined) return null;
  let context = media.series;
  if (
    media.season !== null &&
    media.season !== undefined &&
    media.episode !== null &&
    media.episode !== undefined &&
    Number.isFinite(media.season) &&
    Number.isFinite(media.episode)
  ) {
    context += ` · S${pad2(media.season)}E${pad2(media.episode)}`;
  }
  return context;
}

export interface JellyfinSessionGroups {
  playing: JellyfinSession[];
  paused: JellyfinSession[];
  idle: JellyfinSession[];
}

export function groupJellyfinSessions(sessions: JellyfinSession[]): JellyfinSessionGroups {
  const groups: JellyfinSessionGroups = {
    playing: [],
    paused: [],
    idle: [],
  };
  for (const session of sessions) {
    if (session.state === "playing") {
      groups.playing.push(session);
    } else if (session.state === "paused") {
      groups.paused.push(session);
    } else {
      groups.idle.push(session);
    }
  }
  return groups;
}

export interface JellyfinDetailRow {
  label: string;
  source: string | null;
  output: string | null;
}

export function buildCodecDetailRows(playback: JellyfinPlayback): JellyfinDetailRow[] {
  return [
    { label: "Video codec", source: playback.sourceVideoCodec, output: playback.outputVideoCodec },
    { label: "Audio codec", source: playback.sourceAudioCodec, output: playback.outputAudioCodec },
    { label: "Resolution", source: playback.sourceResolution, output: playback.outputResolution },
  ];
}

export function formatDetailValue(value: string | null): string {
  if (value === null || value === undefined || value.trim() === "") return "—";
  return value.trim();
}

export function formatTranscodeReasons(reasons: readonly string[] | null | undefined): string | null {
  if (!reasons) return null;
  const cleaned = reasons.filter((entry) => typeof entry === "string" && entry.trim() !== "");
  if (cleaned.length === 0) return null;
  return cleaned.join(", ");
}
