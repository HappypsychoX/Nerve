import type {
  JellyfinActivityState,
  JellyfinArtworkRef,
  JellyfinCounts,
  JellyfinMedia,
  JellyfinMediaStream,
  JellyfinNowPlayingItem,
  JellyfinPlayback,
  JellyfinPlayMethod,
  JellyfinSession,
  JellyfinSessionUpstream,
  JellyfinTranscodingInfo,
} from "./types";

export const ANONYMOUS_USER_LABEL = "Unidentified client";
export const TICKS_PER_SECOND = 10_000_000;

export interface NormalizeOptions {
  showPosters?: boolean;
}

const STATE_ORDER: Record<JellyfinActivityState, number> = {
  playing: 0,
  paused: 1,
  idle: 2,
};

function asString(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function ticksToSeconds(ticks: unknown): number | null {
  const n = asNumber(ticks);
  if (n === null || n < 0) return null;
  return Math.round(n / TICKS_PER_SECOND);
}

function durationFromTicks(ticks: unknown): number | null {
  const n = asNumber(ticks);
  if (n === null || n <= 0) return null;
  return Math.round(n / TICKS_PER_SECOND);
}

export function toActivityState(
  session: JellyfinSessionUpstream | null | undefined,
): JellyfinActivityState {
  if (!session?.NowPlayingItem) return "idle";
  return session.PlayState?.IsPaused === true ? "paused" : "playing";
}

export function toPlayMethod(
  session: JellyfinSessionUpstream | null | undefined,
): JellyfinPlayMethod {
  const method = session?.PlayState?.PlayMethod;
  switch (method) {
    case "DirectPlay":
      return "directPlay";
    case "DirectStream":
      return "directStream";
    case "Transcode":
      return "transcode";
    default:
      // Older responses may omit PlayMethod; fall back to the presence of
      // TranscodingInfo, otherwise mark the method unavailable.
      return session?.TranscodingInfo != null ? "transcode" : null;
  }
}

export function parseTranscodeReasons(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

export function artworkRef(
  item: JellyfinNowPlayingItem | null | undefined,
): JellyfinArtworkRef {
  if (!item) return { id: null, tag: null };

  const type = item.Type;
  // Episodes use the series poster (the artwork ID is not media.id).
  if (type === "Episode") {
    const id = asString(item.SeriesId);
    const tag = asString(item.SeriesPrimaryImageTag);
    if (id && tag) return { id, tag };
  }
  // Audio uses the album artwork.
  if (type === "Audio") {
    const id = asString(item.AlbumId);
    const tag = asString(item.AlbumPrimaryImageTag);
    if (id && tag) return { id, tag };
  }

  // Default: the item's own primary image.
  const id = asString(item.Id);
  const tag = asString(item.ImageTags?.Primary);
  if (id && tag) return { id, tag };

  return { id: null, tag: null };
}

export function buildPosterUrl(
  ref: JellyfinArtworkRef,
  showPosters: boolean = true,
): string | null {
  if (!showPosters || !ref.id || !ref.tag) return null;
  return `/api/jellyfin/artwork/${ref.id}?tag=${encodeURIComponent(ref.tag)}`;
}

function formatResolution(width: unknown, height: unknown): string | null {
  const w = asNumber(width);
  const h = asNumber(height);
  if (w === null || h === null || w <= 0 || h <= 0) return null;
  return `${w}x${h}`;
}

function sourceStreams(streams: JellyfinMediaStream[] | undefined): {
  videoCodec: string | null;
  audioCodec: string | null;
  resolution: string | null;
} {
  const video = streams?.find((stream) => stream.Type === "Video");
  const audio = streams?.find((stream) => stream.Type === "Audio");
  return {
    videoCodec: asString(video?.Codec),
    audioCodec: asString(audio?.Codec),
    resolution: formatResolution(video?.Width, video?.Height),
  };
}

function userLabel(session: JellyfinSessionUpstream): string {
  const name = asString(session.UserName);
  if (!name) return ANONYMOUS_USER_LABEL;
  if (name.toLowerCase() === "anonymous") return ANONYMOUS_USER_LABEL;
  return name;
}

function normalizeMedia(
  item: JellyfinNowPlayingItem | null | undefined,
  positionTicks: unknown,
  opts: NormalizeOptions,
): JellyfinMedia {
  if (!item) {
    return {
      id: null,
      type: null,
      title: null,
      series: null,
      season: null,
      episode: null,
      positionSeconds: null,
      durationSeconds: null,
      posterUrl: null,
    };
  }

  return {
    id: asString(item.Id),
    type: asString(item.Type),
    title: asString(item.Name),
    series: asString(item.SeriesName),
    season: asNumber(item.ParentIndexNumber),
    episode: asNumber(item.IndexNumber),
    positionSeconds: ticksToSeconds(positionTicks),
    durationSeconds: durationFromTicks(item.RunTimeTicks),
    posterUrl: buildPosterUrl(artworkRef(item), opts.showPosters),
  };
}

function normalizePlayback(
  session: JellyfinSessionUpstream,
  item: JellyfinNowPlayingItem | null | undefined,
  transcode: JellyfinTranscodingInfo | null | undefined,
): JellyfinPlayback {
  const source = sourceStreams(item?.MediaStreams);
  const output = transcode
    ? {
        videoCodec: asString(transcode.VideoCodec),
        audioCodec: asString(transcode.AudioCodec),
        resolution: formatResolution(transcode.Width, transcode.Height),
      }
    : { videoCodec: null, audioCodec: null, resolution: null };

  return {
    method: toPlayMethod(session),
    sourceVideoCodec: source.videoCodec,
    sourceAudioCodec: source.audioCodec,
    sourceResolution: source.resolution,
    outputVideoCodec: output.videoCodec,
    outputAudioCodec: output.audioCodec,
    outputResolution: output.resolution,
    transcodeReasons: parseTranscodeReasons(transcode?.TranscodeReasons),
  };
}

export function normalizeSession(
  session: JellyfinSessionUpstream,
  opts: NormalizeOptions = {},
): JellyfinSession | null {
  if (!session || typeof session !== "object") return null;

  const item = session.NowPlayingItem ?? null;
  const positionTicks = session.PlayState?.PositionTicks ?? null;

  return {
    id: asString(session.Id),
    user: userLabel(session),
    client: asString(session.Client),
    device: asString(session.DeviceName),
    state: toActivityState(session),
    media: normalizeMedia(item, positionTicks, opts),
    playback: normalizePlayback(session, item, session.TranscodingInfo ?? null),
  };
}

export function normalizeSessions(
  sessions: unknown,
  opts: NormalizeOptions = {},
): JellyfinSession[] {
  if (!Array.isArray(sessions)) return [];
  const normalized: JellyfinSession[] = [];
  for (const session of sessions) {
    const result = normalizeSession(session as JellyfinSessionUpstream, opts);
    if (result) normalized.push(result);
  }
  return normalized;
}

export function deriveCounts(sessions: JellyfinSession[]): JellyfinCounts {
  const counts: JellyfinCounts = {
    playing: 0,
    paused: 0,
    idle: 0,
    transcoding: 0,
  };
  for (const session of sessions) {
    if (session.state === "playing") counts.playing += 1;
    else if (session.state === "paused") counts.paused += 1;
    else counts.idle += 1;
    // Transcoding is a subset of playing/paused only; an idle session with a
    // stale TranscodingInfo/PlayMethod must not count toward transcoding.
    if (
      (session.state === "playing" || session.state === "paused") &&
      session.playback.method === "transcode"
    ) {
      counts.transcoding += 1;
    }
  }
  return counts;
}

export function sortSessions(sessions: JellyfinSession[]): JellyfinSession[] {
  return [...sessions].sort((a, b) => {
    const stateDelta = STATE_ORDER[a.state] - STATE_ORDER[b.state];
    if (stateDelta !== 0) return stateDelta;
    const userDelta = a.user.localeCompare(b.user);
    if (userDelta !== 0) return userDelta;
    return (a.id ?? "").localeCompare(b.id ?? "");
  });
}
