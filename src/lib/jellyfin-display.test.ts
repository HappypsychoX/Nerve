import { describe, expect, it } from "vitest";
import {
  buildTvContext,
  EMPTY_JELLYFIN_COUNTS,
  formatPlaybackTime,
  groupJellyfinSessions,
  jellyfinMethodLabel,
  JELLYFIN_STATUS_HEALTH,
  JELLYFIN_STATUS_LABEL,
  progressPercent,
} from "@/lib/jellyfin-display";
import type { JellyfinMedia, JellyfinSession } from "@/lib/integrations/jellyfin/types";

function mediaStub(overrides: Partial<JellyfinMedia> = {}): JellyfinMedia {
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
    ...overrides,
  };
}

function playbackStub(method: JellyfinSession["playback"]["method"] = null): JellyfinSession["playback"] {
  return {
    method,
    sourceVideoCodec: null,
    sourceAudioCodec: null,
    sourceResolution: null,
    outputVideoCodec: null,
    outputAudioCodec: null,
    outputResolution: null,
    transcodeReasons: [],
  };
}

function sessionStub(
  id: string,
  user: string,
  state: JellyfinSession["state"],
): JellyfinSession {
  return {
    id,
    user,
    client: null,
    device: null,
    state,
    media: mediaStub(),
    playback: playbackStub(),
  };
}

describe("progressPercent", () => {
  it("returns 0 for position at start", () => {
    expect(progressPercent(0, 100)).toBe(0);
  });

  it("returns the correct percentage for a mid-stream position", () => {
    expect(progressPercent(420, 900)).toBeCloseTo(46.67, 2);
  });

  it("returns null for null position", () => {
    expect(progressPercent(null, 100)).toBeNull();
  });

  it("returns null for null duration", () => {
    expect(progressPercent(10, null)).toBeNull();
  });

  it("returns null for zero or negative duration", () => {
    expect(progressPercent(10, 0)).toBeNull();
    expect(progressPercent(10, -100)).toBeNull();
  });

  it("clamps position outside the range", () => {
    expect(progressPercent(150, 100)).toBe(100);
    expect(progressPercent(-5, 100)).toBe(0);
  });

  it("returns null for non-finite inputs", () => {
    expect(progressPercent(Number.POSITIVE_INFINITY, 100)).toBeNull();
    expect(progressPercent(10, Number.NaN)).toBeNull();
    expect(progressPercent(Number.NaN, 100)).toBeNull();
  });
});

describe("formatPlaybackTime", () => {
  it("formats unavailable durations as an em dash", () => {
    expect(formatPlaybackTime(null)).toBe("—");
    expect(formatPlaybackTime(-1)).toBe("—");
    expect(formatPlaybackTime(Number.NaN)).toBe("—");
  });

  it("formats zero and short durations", () => {
    expect(formatPlaybackTime(0)).toBe("0:00");
    expect(formatPlaybackTime(65)).toBe("1:05");
  });

  it("formats durations just under and over an hour", () => {
    expect(formatPlaybackTime(3599)).toBe("59:59");
    expect(formatPlaybackTime(3600)).toBe("1:00:00");
    expect(formatPlaybackTime(3725)).toBe("1:02:05");
  });
});

describe("jellyfinMethodLabel", () => {
  it("maps playback methods to labels", () => {
    expect(jellyfinMethodLabel("directPlay")).toBe("Direct play");
    expect(jellyfinMethodLabel("directStream")).toBe("Direct stream");
    expect(jellyfinMethodLabel("transcode")).toBe("Transcoding");
    expect(jellyfinMethodLabel(null)).toBe("—");
  });
});

describe("buildTvContext", () => {
  it("returns null when no series is present", () => {
    expect(buildTvContext(mediaStub())).toBeNull();
  });

  it("returns just the series name when season/episode are absent", () => {
    expect(buildTvContext(mediaStub({ series: "Show" }))).toBe("Show");
  });

  it("includes padded season and episode numbers", () => {
    expect(buildTvContext(mediaStub({ series: "Show", season: 1, episode: 3 }))).toBe("Show · S01E03");
    expect(buildTvContext(mediaStub({ series: "Show", season: 12, episode: 34 }))).toBe("Show · S12E34");
  });
});

describe("groupJellyfinSessions", () => {
  it("buckets sessions by state", () => {
    const playing = sessionStub("p1", "alice", "playing");
    const paused = sessionStub("p2", "bob", "paused");
    const idle1 = sessionStub("i1", "carol", "idle");
    const idle2 = sessionStub("i2", "dave", "idle");

    const groups = groupJellyfinSessions([idle1, playing, paused, idle2]);
    expect(groups.playing).toEqual([playing]);
    expect(groups.paused).toEqual([paused]);
    expect(groups.idle).toEqual([idle1, idle2]);
  });
});

describe("status maps", () => {
  it("maps online to healthy and Online", () => {
    expect(JELLYFIN_STATUS_HEALTH.online).toBe("healthy");
    expect(JELLYFIN_STATUS_LABEL.online).toBe("Online");
  });

  it("maps offline to offline and Offline", () => {
    expect(JELLYFIN_STATUS_HEALTH.offline).toBe("offline");
    expect(JELLYFIN_STATUS_LABEL.offline).toBe("Offline");
  });

  it("maps unauthorized to degraded and Unauthorized", () => {
    expect(JELLYFIN_STATUS_HEALTH.unauthorized).toBe("degraded");
    expect(JELLYFIN_STATUS_LABEL.unauthorized).toBe("Unauthorized");
  });

  it("maps unconfigured and disabled to unknown", () => {
    expect(JELLYFIN_STATUS_HEALTH.unconfigured).toBe("unknown");
    expect(JELLYFIN_STATUS_HEALTH.disabled).toBe("unknown");
  });

  it("maps error to degraded", () => {
    expect(JELLYFIN_STATUS_HEALTH.error).toBe("degraded");
    expect(JELLYFIN_STATUS_LABEL.error).toBe("Error");
  });
});

describe("EMPTY_JELLYFIN_COUNTS", () => {
  it("has all zero counts", () => {
    expect(EMPTY_JELLYFIN_COUNTS).toEqual({
      playing: 0,
      paused: 0,
      idle: 0,
      transcoding: 0,
    });
  });
});
