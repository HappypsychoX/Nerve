// Partial upstream Jellyfin types. Every field is optional because the
// shapes vary across versions and sessions; the normalizer treats missing
// values as unavailable rather than assuming a fixed schema.
//
// The normalizer must never spread or forward these raw objects — the
// allowlisted DTOs below are the only shapes that leave this module.

export interface JellyfinPublicInfo {
  ServerName?: string;
  Version?: string;
  Id?: string;
  ProductName?: string;
  OperatingSystem?: string;
  [key: string]: unknown;
}

export interface JellyfinMediaStream {
  Type?: string;
  Codec?: string;
  Width?: number;
  Height?: number;
  [key: string]: unknown;
}

export interface JellyfinPlayState {
  IsPaused?: boolean;
  PositionTicks?: number | null;
  PlayMethod?: string | null;
  [key: string]: unknown;
}

export interface JellyfinTranscodingInfo {
  VideoCodec?: string;
  AudioCodec?: string;
  Width?: number;
  Height?: number;
  TranscodeReasons?: string[] | string;
  [key: string]: unknown;
}

export interface JellyfinNowPlayingItem {
  Id?: string;
  Name?: string;
  Type?: string;
  SeriesName?: string;
  SeriesId?: string;
  SeasonName?: string;
  // Season number for episodes.
  ParentIndexNumber?: number;
  // Episode number for episodes.
  IndexNumber?: number;
  RunTimeTicks?: number | null;
  ImageTags?: Record<string, string>;
  SeriesPrimaryImageTag?: string;
  AlbumId?: string;
  AlbumPrimaryImageTag?: string;
  MediaStreams?: JellyfinMediaStream[];
  [key: string]: unknown;
}

export interface JellyfinSessionUpstream {
  Id?: string;
  UserId?: string;
  UserName?: string;
  Client?: string;
  DeviceName?: string;
  DeviceId?: string;
  RemoteEndPoint?: string;
  PlayState?: JellyfinPlayState;
  NowPlayingItem?: JellyfinNowPlayingItem | null;
  TranscodingInfo?: JellyfinTranscodingInfo | null;
  LastActivityDate?: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Normalized DTOs (allowlisted; never forward raw upstream fields)
// ---------------------------------------------------------------------------

export type JellyfinStatus =
  | "online"
  | "offline"
  | "unauthorized"
  | "unconfigured"
  | "disabled"
  | "error";

export type JellyfinActivityState = "playing" | "paused" | "idle";

export type JellyfinPlayMethod =
  | "directPlay"
  | "directStream"
  | "transcode"
  | null;

export interface JellyfinCounts {
  playing: number;
  paused: number;
  idle: number;
  // Subset of playing + paused; not a fourth mutually exclusive state.
  transcoding: number;
}

export interface JellyfinArtworkRef {
  id: string | null;
  tag: string | null;
}

export interface JellyfinMedia {
  id: string | null;
  type: string | null;
  title: string | null;
  series: string | null;
  season: number | null;
  episode: number | null;
  positionSeconds: number | null;
  durationSeconds: number | null;
  posterUrl: string | null;
}

export interface JellyfinPlayback {
  method: JellyfinPlayMethod;
  sourceVideoCodec: string | null;
  sourceAudioCodec: string | null;
  sourceResolution: string | null;
  outputVideoCodec: string | null;
  outputAudioCodec: string | null;
  outputResolution: string | null;
  transcodeReasons: string[];
}

export interface JellyfinSession {
  id: string | null;
  user: string;
  client: string | null;
  device: string | null;
  state: JellyfinActivityState;
  media: JellyfinMedia;
  playback: JellyfinPlayback;
}

export interface JellyfinSessionsResponse {
  status: JellyfinStatus;
  observedAt: string | null;
  counts: JellyfinCounts;
  sessions: JellyfinSession[];
}

export interface JellyfinHealthResponse {
  status: JellyfinStatus;
  version: string | null;
  observedAt: string | null;
}
