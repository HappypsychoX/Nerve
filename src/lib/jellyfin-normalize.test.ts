import { describe, expect, it } from "vitest";
import {
  ANONYMOUS_USER_LABEL,
  artworkRef,
  buildPosterUrl,
  deriveCounts,
  normalizeSession,
  normalizeSessions,
  parseTranscodeReasons,
  sortSessions,
  ticksToSeconds,
  toActivityState,
  toPlayMethod,
} from "@/lib/integrations/jellyfin/normalize";
import type {
  JellyfinNowPlayingItem,
  JellyfinSession,
  JellyfinSessionUpstream,
} from "@/lib/integrations/jellyfin/types";

function makeSession(
  overrides: Partial<JellyfinSessionUpstream> = {},
): JellyfinSessionUpstream {
  return {
    Id: "session-1",
    UserName: "alice",
    Client: "Jellyfin Web",
    DeviceName: "Desktop",
    PlayState: { IsPaused: false, PositionTicks: 0 },
    NowPlayingItem: {
      Id: "media-1",
      Name: "Example Movie",
      Type: "Movie",
      RunTimeTicks: 0,
    },
    ...overrides,
  };
}

function makeItem(
  overrides: Partial<JellyfinNowPlayingItem> = {},
): JellyfinNowPlayingItem {
  return {
    Id: "0123456789abcdef0123456789abcdef",
    Name: "Movie",
    Type: "Movie",
    ImageTags: { Primary: "0123456789abcdef0123456789abcdef" },
    ...overrides,
  };
}

describe("ticksToSeconds", () => {
  it("converts ticks using 10,000,000 ticks per second", () => {
    expect(ticksToSeconds(10_000_000)).toBe(1);
    expect(ticksToSeconds(25_000_000)).toBe(3);
    expect(ticksToSeconds(9_000_000_000)).toBe(900);
  });

  it("returns 0 for zero ticks (valid position)", () => {
    expect(ticksToSeconds(0)).toBe(0);
  });

  it("returns null for missing or invalid ticks", () => {
    expect(ticksToSeconds(null)).toBeNull();
    expect(ticksToSeconds(undefined)).toBeNull();
    expect(ticksToSeconds(-5)).toBeNull();
    expect(ticksToSeconds("nope")).toBeNull();
  });
});

describe("toActivityState", () => {
  it("classifies playing, paused, and idle", () => {
    expect(toActivityState(makeSession())).toBe("playing");
    expect(
      toActivityState(
        makeSession({ PlayState: { IsPaused: true } }),
      ),
    ).toBe("paused");
    expect(toActivityState(makeSession({ NowPlayingItem: null }))).toBe("idle");
    expect(toActivityState(null)).toBe("idle");
  });
});

describe("toPlayMethod", () => {
  it("maps Jellyfin PlayMethod values", () => {
    expect(
      toPlayMethod(makeSession({ PlayState: { PlayMethod: "DirectPlay" } })),
    ).toBe("directPlay");
    expect(
      toPlayMethod(makeSession({ PlayState: { PlayMethod: "DirectStream" } })),
    ).toBe("directStream");
    expect(
      toPlayMethod(makeSession({ PlayState: { PlayMethod: "Transcode" } })),
    ).toBe("transcode");
  });

  it("falls back to transcoding when PlayMethod is absent", () => {
    expect(
      toPlayMethod(makeSession({ TranscodingInfo: { VideoCodec: "h264" } })),
    ).toBe("transcode");
  });

  it("returns null when neither method nor transcoding info is present", () => {
    expect(toPlayMethod(makeSession())).toBeNull();
  });
});

describe("parseTranscodeReasons", () => {
  it("accepts an array", () => {
    expect(parseTranscodeReasons(["ContainerBitrateExceedsLimit", "AudioCodecNotSupported"])).toEqual([
      "ContainerBitrateExceedsLimit",
      "AudioCodecNotSupported",
    ]);
  });

  it("accepts a comma-separated string", () => {
    expect(parseTranscodeReasons("ContainerBitrateExceedsLimit, AudioCodecNotSupported")).toEqual([
      "ContainerBitrateExceedsLimit",
      "AudioCodecNotSupported",
    ]);
  });

  it("returns an empty array for missing or empty values", () => {
    expect(parseTranscodeReasons(undefined)).toEqual([]);
    expect(parseTranscodeReasons(null)).toEqual([]);
    expect(parseTranscodeReasons("")).toEqual([]);
    expect(parseTranscodeReasons(42)).toEqual([]);
  });
});

describe("artworkRef", () => {
  it("uses the item's own primary image for a movie", () => {
    const item = makeItem({ Type: "Movie" });
    expect(artworkRef(item)).toEqual({
      id: "0123456789abcdef0123456789abcdef",
      tag: "0123456789abcdef0123456789abcdef",
    });
  });

  it("uses the series image for an episode", () => {
    const item = makeItem({
      Type: "Episode",
      SeriesId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      SeriesPrimaryImageTag: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
    expect(artworkRef(item)).toEqual({
      id: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      tag: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });
  });

  it("uses the album image for audio", () => {
    const item = makeItem({
      Type: "Audio",
      AlbumId: "cccccccccccccccccccccccccccccccc",
      AlbumPrimaryImageTag: "dddddddddddddddddddddddddddddddd",
    });
    expect(artworkRef(item)).toEqual({
      id: "cccccccccccccccccccccccccccccccc",
      tag: "dddddddddddddddddddddddddddddddd",
    });
  });

  it("returns null when no usable image reference exists", () => {
    expect(artworkRef(null)).toEqual({ id: null, tag: null });
    expect(artworkRef(makeItem({ ImageTags: undefined }))).toEqual({
      id: null,
      tag: null,
    });
  });
});

describe("buildPosterUrl", () => {
  it("builds a relative artwork URL", () => {
    expect(
      buildPosterUrl({
        id: "0123456789abcdef0123456789abcdef",
        tag: "validatedTag",
      }),
    ).toBe("/api/jellyfin/artwork/0123456789abcdef0123456789abcdef?tag=validatedTag");
  });

  it("returns null when posters are disabled or the ref is incomplete", () => {
    expect(
      buildPosterUrl(
        { id: "0123456789abcdef0123456789abcdef", tag: "x" },
        false,
      ),
    ).toBeNull();
    expect(buildPosterUrl({ id: null, tag: null })).toBeNull();
  });
});

describe("normalizeSession", () => {
  it("maps a playing session into an allowlisted DTO", () => {
    const result = normalizeSession(
      makeSession({
        PlayState: { IsPaused: false, PositionTicks: 4_200_000_000 },
        NowPlayingItem: {
          Id: "m1",
          Name: "Example Movie",
          Type: "Movie",
          RunTimeTicks: 9_000_000_000,
          ImageTags: { Primary: "tag1" },
          MediaStreams: [
            { Type: "Video", Codec: "h264", Width: 1920, Height: 1080 },
            { Type: "Audio", Codec: "aac" },
          ],
        },
      }),
    );

    expect(result).toEqual({
      id: "session-1",
      user: "alice",
      client: "Jellyfin Web",
      device: "Desktop",
      state: "playing",
      media: {
        id: "m1",
        type: "Movie",
        title: "Example Movie",
        series: null,
        season: null,
        episode: null,
        positionSeconds: 420,
        durationSeconds: 900,
        posterUrl: "/api/jellyfin/artwork/m1?tag=tag1",
      },
      playback: {
        method: null,
        sourceVideoCodec: "h264",
        sourceAudioCodec: "aac",
        sourceResolution: "1920x1080",
        outputVideoCodec: null,
        outputAudioCodec: null,
        outputResolution: null,
        transcodeReasons: [],
      },
    });
  });

  it("keeps TV season and episode context", () => {
    const result = normalizeSession(
      makeSession({
        NowPlayingItem: {
          Id: "e1",
          Name: "Chapter One",
          Type: "Episode",
          SeriesName: "Example Series",
          ParentIndexNumber: 2,
          IndexNumber: 5,
          RunTimeTicks: null,
        },
      }),
    );
    expect(result?.media.series).toBe("Example Series");
    expect(result?.media.season).toBe(2);
    expect(result?.media.episode).toBe(5);
    expect(result?.media.durationSeconds).toBeNull();
  });

  it("uses a generic label for anonymous sessions", () => {
    expect(normalizeSession(makeSession({ UserName: undefined }))?.user).toBe(
      ANONYMOUS_USER_LABEL,
    );
    expect(normalizeSession(makeSession({ UserName: "" }))?.user).toBe(
      ANONYMOUS_USER_LABEL,
    );
    expect(normalizeSession(makeSession({ UserName: "Anonymous" }))?.user).toBe(
      ANONYMOUS_USER_LABEL,
    );
  });

  it("represents missing fields as null, never fabricated values", () => {
    const result = normalizeSession(
      makeSession({
        Id: undefined,
        Client: undefined,
        DeviceName: undefined,
        PlayState: {},
        NowPlayingItem: { Id: "x", Name: "", Type: "Movie" },
      }),
    );
    expect(result?.id).toBeNull();
    expect(result?.client).toBeNull();
    expect(result?.device).toBeNull();
    expect(result?.media.title).toBeNull();
    expect(result?.media.positionSeconds).toBeNull();
    expect(result?.media.durationSeconds).toBeNull();
    expect(result?.playback.method).toBeNull();
  });

  it("returns null for a non-object session", () => {
    expect(normalizeSession(null as unknown as JellyfinSessionUpstream)).toBeNull();
  });
});

describe("privacy allowlist", () => {
  it("never leaks raw fields, endpoints, ids, or tokens", () => {
    const raw: JellyfinSessionUpstream = {
      Id: "session-1",
      UserName: "alice",
      RemoteEndPoint: "203.0.113.9",
      DeviceId: "device-secret",
      UserId: "user-secret",
      Capabilities: { PlayableMediaTypes: ["Video"] },
      PlayQueue: ["secret-queue"],
      SupportedCommands: ["Play"],
      AppName: "Jellyfin Web",
      NowPlayingItem: {
        Id: "m1",
        Name: "Movie",
        Type: "Movie",
        RunTimeTicks: 1000,
      },
    };

    const result = normalizeSession(raw);
    expect(result).not.toBeNull();
    const json = JSON.stringify(result);

    expect(json).not.toContain("RemoteEndPoint");
    expect(json).not.toContain("DeviceId");
    expect(json).not.toContain("UserId");
    expect(json).not.toContain("Capabilities");
    expect(json).not.toContain("PlayQueue");
    expect(json).not.toContain("SupportedCommands");
    expect(json).not.toContain("203.0.113.9");
    expect(json).not.toContain("device-secret");
    expect(json).not.toContain("user-secret");
    expect(json).not.toContain("secret-queue");

    // Only allowlisted keys remain on the session object.
    expect(Object.keys(result as JellyfinSession).sort()).toEqual([
      "client",
      "device",
      "id",
      "media",
      "playback",
      "state",
      "user",
    ]);
  });
});

describe("deriveCounts", () => {
  it("counts each state exactly once and derives transcoding as a subset", () => {
    const sessions: JellyfinSession[] = [
      {
        id: "1",
        user: "a",
        client: null,
        device: null,
        state: "playing",
        media: mediaStub(),
        playback: playbackStub("transcode"),
      },
      {
        id: "2",
        user: "b",
        client: null,
        device: null,
        state: "playing",
        media: mediaStub(),
        playback: playbackStub("directPlay"),
      },
      {
        id: "3",
        user: "c",
        client: null,
        device: null,
        state: "paused",
        media: mediaStub(),
        playback: playbackStub(null),
      },
      {
        id: "4",
        user: "d",
        client: null,
        device: null,
        state: "idle",
        media: mediaStub(),
        playback: playbackStub(null),
      },
    ];
    expect(deriveCounts(sessions)).toEqual({
      playing: 2,
      paused: 1,
      idle: 1,
      transcoding: 1,
    });
  });

  it("does not count transcoding for idle sessions with stale TranscodingInfo/PlayMethod", () => {
    const stalePlayMethod = makeSession({
      NowPlayingItem: null,
      PlayState: { IsPaused: false, PlayMethod: "Transcode" },
    });
    const staleTranscodeInfo = makeSession({
      NowPlayingItem: null,
      PlayState: { IsPaused: false },
      TranscodingInfo: { VideoCodec: "h264" },
    });

    const byPlayMethod = normalizeSession(stalePlayMethod);
    const byTranscodeInfo = normalizeSession(staleTranscodeInfo);

    expect(byPlayMethod).not.toBeNull();
    expect(byTranscodeInfo).not.toBeNull();
    expect(byPlayMethod?.state).toBe("idle");
    expect(byPlayMethod?.playback.method).toBe("transcode");
    expect(byTranscodeInfo?.state).toBe("idle");
    expect(byTranscodeInfo?.playback.method).toBe("transcode");

    // Transcoding is a subset of playing/paused only.
    expect(deriveCounts([byPlayMethod!, byTranscodeInfo!])).toEqual({
      playing: 0,
      paused: 0,
      idle: 2,
      transcoding: 0,
    });
  });
});

describe("sortSessions", () => {
  it("orders playing, paused, idle then by user then id", () => {
    const sessions: JellyfinSession[] = [
      sessionStub("z-idle", "zed", "idle"),
      sessionStub("a-playing", "amy", "playing"),
      sessionStub("b-playing", "bob", "playing"),
      sessionStub("p-paused", "pam", "paused"),
    ];
    const sorted = sortSessions(sessions);
    expect(sorted.map((s) => s.id)).toEqual([
      "a-playing",
      "b-playing",
      "p-paused",
      "z-idle",
    ]);
  });

  it("does not mutate its input", () => {
    const sessions = [sessionStub("1", "a", "idle"), sessionStub("2", "b", "playing")];
    const copy = [...sessions];
    sortSessions(sessions);
    expect(sessions).toEqual(copy);
  });
});

function mediaStub() {
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

function playbackStub(method: "directPlay" | "directStream" | "transcode" | null) {
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

function sessionStub(id: string, user: string, state: "playing" | "paused" | "idle"): JellyfinSession {
  return {
    id,
    user,
    client: null,
    device: null,
    state,
    media: mediaStub(),
    playback: playbackStub(null),
  };
}

describe("normalizeSessions", () => {
  it("returns an empty array for non-array input", () => {
    expect(normalizeSessions({})).toEqual([]);
    expect(normalizeSessions(null)).toEqual([]);
  });

  it("skips non-object entries", () => {
    expect(
      normalizeSessions([null, 42, makeSession()]),
    ).toHaveLength(1);
  });
});
