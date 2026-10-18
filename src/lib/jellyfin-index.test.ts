import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getJellyfinHealth,
  getJellyfinSessions,
  mapJellyfinErrorToStatus,
} from "@/lib/integrations/jellyfin";
import type { JellyfinDisplayConfig } from "@/lib/config";

const CONFIG: JellyfinDisplayConfig = {
  enabled: true,
  showPosters: true,
  showIdleClients: true,
};

function jsonResponse(data: unknown): Response {
  return {
    status: 200,
    ok: true,
    json: async () => data,
  } as unknown as Response;
}

function httpResponse(status: number): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => ({}),
  } as unknown as Response;
}

beforeEach(() => {
  vi.stubEnv("JELLYFIN_URL", "http://jellyfin:8096");
  vi.stubEnv("JELLYFIN_API_KEY", "secret-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("mapJellyfinErrorToStatus", () => {
  it("maps every internal error to a public status", () => {
    expect(mapJellyfinErrorToStatus("auth")).toBe("unauthorized");
    expect(mapJellyfinErrorToStatus("timeout")).toBe("offline");
    expect(mapJellyfinErrorToStatus("network")).toBe("offline");
    expect(mapJellyfinErrorToStatus("http")).toBe("error");
    expect(mapJellyfinErrorToStatus("malformed")).toBe("error");
    expect(mapJellyfinErrorToStatus("unsupported-type")).toBe("error");
    expect(mapJellyfinErrorToStatus("oversize")).toBe("error");
  });
});

describe("getJellyfinSessions", () => {
  it("short-circuits to disabled with zero network requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getJellyfinSessions({ ...CONFIG, enabled: false });
    expect(result.status).toBe("disabled");
    expect(result.sessions).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("short-circuits to unconfigured with zero network requests", async () => {
    vi.stubEnv("JELLYFIN_URL", "");
    vi.stubEnv("JELLYFIN_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await getJellyfinSessions(CONFIG);
    expect(result.status).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns normalized sessions when online", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            Id: "s1",
            UserName: "alice",
            Client: "Jellyfin Web",
            PlayState: { IsPaused: false, PositionTicks: 0 },
            NowPlayingItem: {
              Id: "m1",
              Name: "Movie",
              Type: "Movie",
              RunTimeTicks: 10_000_000,
            },
          },
        ]),
      ),
    );

    const result = await getJellyfinSessions(CONFIG);
    expect(result.status).toBe("online");
    expect(result.observedAt).toBeTruthy();
    expect(result.counts).toEqual({ playing: 1, paused: 0, idle: 0, transcoding: 0 });
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0].user).toBe("alice");
    expect(result.sessions[0].state).toBe("playing");
  });

  it("maps a bad key to unauthorized", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(httpResponse(401)));
    const result = await getJellyfinSessions(CONFIG);
    expect(result.status).toBe("unauthorized");
    expect(result.sessions).toEqual([]);
  });

  it("maps a network failure to offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    const result = await getJellyfinSessions(CONFIG);
    expect(result.status).toBe("offline");
  });

  it("maps a malformed response to error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ not: "an array" })),
    );
    const result = await getJellyfinSessions(CONFIG);
    expect(result.status).toBe("error");
  });
});

describe("getJellyfinHealth", () => {
  it("reports disabled and unconfigured without network requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(getJellyfinHealth({ ...CONFIG, enabled: false })).resolves.toMatchObject({
      status: "disabled",
      version: null,
    });

    vi.stubEnv("JELLYFIN_URL", "");
    await expect(getJellyfinHealth(CONFIG)).resolves.toMatchObject({
      status: "unconfigured",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows a version alongside an auth failure", async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("/System/Info/Public")) {
        return jsonResponse({ Version: "10.11.11" });
      }
      return httpResponse(401);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getJellyfinHealth(CONFIG);
    expect(result.status).toBe("unauthorized");
    expect(result.version).toBe("10.11.11");
  });

  it("reports online with a version when sessions succeed", async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("/System/Info/Public")) {
        return jsonResponse({ Version: "10.11.11" });
      }
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getJellyfinHealth(CONFIG);
    expect(result.status).toBe("online");
    expect(result.version).toBe("10.11.11");
  });
});
