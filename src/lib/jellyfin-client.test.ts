import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JELLYFIN_ACTIVE_WINDOW_SECONDS,
  JELLYFIN_MAX_IMAGE_BYTES,
  JELLYFIN_TIMEOUT_MS,
  fetchJellyfinPrimaryImage,
  fetchJellyfinPublicInfo,
  fetchJellyfinSessions,
  isValidJellyfinImageTag,
  isValidJellyfinItemId,
} from "@/lib/integrations/jellyfin/client";

const BASE = "http://jellyfin:8096";

function mockResponse(init: {
  status?: number;
  ok?: boolean;
  json?: () => Promise<unknown>;
  headers?: Record<string, string>;
  body?: ReadableStream<Uint8Array> | null;
  arrayBuffer?: () => Promise<ArrayBuffer>;
}): Response {
  const headers = new Headers(init.headers ?? {});
  return {
    status: init.status ?? 200,
    ok: init.ok ?? true,
    json: init.json ?? (async () => ({})),
    headers,
    body: init.body ?? null,
    arrayBuffer: init.arrayBuffer ?? (async () => new ArrayBuffer(0)),
  } as unknown as Response;
}

function jsonResponse(data: unknown): Response {
  return mockResponse({ json: async () => data });
}

beforeEach(() => {
  vi.stubEnv("JELLYFIN_URL", BASE);
  vi.stubEnv("JELLYFIN_API_KEY", "secret-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("fetchJellyfinSessions", () => {
  it("uses the fixed path, active window, and MediaBrowser token header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchJellyfinSessions();
    expect(result.ok).toBe(true);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/Sessions?activeWithinSeconds=${JELLYFIN_ACTIVE_WINDOW_SECONDS}`);
    expect(JELLYFIN_ACTIVE_WINDOW_SECONDS).toBe(960);
    expect(String(url)).not.toContain("api_key");
    expect(String(url)).not.toContain("secret-key");

    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('MediaBrowser Token="secret-key"');
  });

  it("maps 401 to auth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({ status: 401, ok: false })),
    );
    await expect(fetchJellyfinSessions()).resolves.toEqual({
      ok: false,
      error: "auth",
      status: 401,
    });
  });

  it("maps 403 to auth", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({ status: 403, ok: false })),
    );
    await expect(fetchJellyfinSessions()).resolves.toEqual({
      ok: false,
      error: "auth",
      status: 403,
    });
  });

  it("maps a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(fetchJellyfinSessions()).resolves.toEqual({
      ok: false,
      error: "network",
      status: null,
    });
  });

  it("maps an abort to a timeout", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: unknown, init: RequestInit | undefined) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchJellyfinSessions();
    await vi.advanceTimersByTimeAsync(JELLYFIN_TIMEOUT_MS + 1);

    await expect(promise).resolves.toEqual({
      ok: false,
      error: "timeout",
      status: null,
    });
    expect(JELLYFIN_TIMEOUT_MS).toBe(5000);
  });

  it("maps malformed JSON to malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          json: async () => {
            throw new SyntaxError("bad json");
          },
        }),
      ),
    );
    await expect(fetchJellyfinSessions()).resolves.toEqual({
      ok: false,
      error: "malformed",
      status: 200,
    });
  });

  it("maps a non-array body to malformed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ not: "an array" })),
    );
    await expect(fetchJellyfinSessions()).resolves.toEqual({
      ok: false,
      error: "malformed",
      status: 200,
    });
  });

  it("refuses redirects without following them", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(mockResponse({ status: 302, ok: false }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJellyfinSessions()).resolves.toEqual({
      ok: false,
      error: "http",
      status: 302,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("makes no fetch call when the base URL is unconfigured", async () => {
    vi.stubEnv("JELLYFIN_URL", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJellyfinSessions()).resolves.toEqual({
      ok: false,
      error: "http",
      status: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchJellyfinPublicInfo", () => {
  it("omits the Authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ Version: "10.11.11" }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchJellyfinPublicInfo();
    const [, init] = fetchMock.mock.calls[0];
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("validators", () => {
  it("accepts 32-hex and dashed GUID item IDs", () => {
    expect(isValidJellyfinItemId("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(
      isValidJellyfinItemId("01234567-89ab-cdef-0123-456789abcdef"),
    ).toBe(true);
  });

  it("rejects invalid item IDs", () => {
    expect(isValidJellyfinItemId("../etc/passwd")).toBe(false);
    expect(isValidJellyfinItemId("0123456789abcdef0123456789abcde")).toBe(false);
    expect(isValidJellyfinItemId("")).toBe(false);
    expect(isValidJellyfinItemId(undefined)).toBe(false);
    expect(isValidJellyfinItemId(42)).toBe(false);
  });

  it("accepts a restrictive image tag and rejects traversal", () => {
    expect(isValidJellyfinImageTag("0123456789abcdef0123456789abcdef")).toBe(true);
    expect(isValidJellyfinImageTag("../")).toBe(false);
    expect(isValidJellyfinImageTag("a/b")).toBe(false);
    expect(isValidJellyfinImageTag("")).toBe(false);
  });
});

describe("fetchJellyfinPrimaryImage", () => {
  const itemId = "0123456789abcdef0123456789abcdef";
  const tag = "validatedTag";

  it("returns http without an upstream call for an invalid item ID", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJellyfinPrimaryImage("../../etc", tag)).resolves.toEqual({
      ok: false,
      error: "http",
      status: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns http without an upstream call for an invalid tag", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJellyfinPrimaryImage(itemId, "bad/tag")).resolves.toEqual({
      ok: false,
      error: "http",
      status: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported content types", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          headers: { "content-type": "image/svg+xml" },
        }),
      ),
    );
    await expect(fetchJellyfinPrimaryImage(itemId, tag)).resolves.toEqual({
      ok: false,
      error: "unsupported-type",
      status: 200,
    });
  });

  it("rejects an oversized declared body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          headers: {
            "content-type": "image/jpeg",
            "content-length": String(JELLYFIN_MAX_IMAGE_BYTES + 1),
          },
        }),
      ),
    );
    await expect(fetchJellyfinPrimaryImage(itemId, tag)).resolves.toEqual({
      ok: false,
      error: "oversize",
      status: 200,
    });
  });

  it("returns image bytes and content type on success", async () => {
    const buffer = new ArrayBuffer(4);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse({
          headers: { "content-type": "image/png" },
          arrayBuffer: async () => buffer,
        }),
      ),
    );
    const result = await fetchJellyfinPrimaryImage(itemId, tag);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.contentType).toBe("image/png");
      expect(result.data).toBe(buffer);
    }
  });
});
