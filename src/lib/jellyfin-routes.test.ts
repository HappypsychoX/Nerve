import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getSessions } from "@/app/api/jellyfin/sessions/route";
import { GET as getHealth } from "@/app/api/jellyfin/health/route";
import { GET as getArtwork } from "@/app/api/jellyfin/artwork/[itemId]/route";
import {
  JELLYFIN_MAX_IMAGE_BYTES,
  JELLYFIN_TIMEOUT_MS,
} from "@/lib/integrations/jellyfin/client";

const BASE = "http://jellyfin:8096";
const KEY = "secret-key";
const ITEM_ID = "0123456789abcdef0123456789abcdef";
const TAG = "validatedTag";

function jsonResponse(data: unknown, status = 200): Response {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => data,
    headers: new Headers(),
  } as unknown as Response;
}

interface ImageResponseInit {
  contentType?: string;
  status?: number;
  contentLength?: number;
  buffer?: ArrayBuffer;
  stream?: ReadableStream<Uint8Array>;
}

function imageResponse(init: ImageResponseInit = {}): Response {
  const headers = new Headers();
  if (init.contentType) headers.set("content-type", init.contentType);
  if (init.contentLength !== undefined) {
    headers.set("content-length", String(init.contentLength));
  }
  const status = init.status ?? 200;
  return {
    status,
    ok: status >= 200 && status < 300,
    headers,
    body: init.stream ?? null,
    arrayBuffer: async () => init.buffer ?? new ArrayBuffer(0),
  } as unknown as Response;
}

function chunkedStream(totalBytes: number): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(64 * 1024);
  let emitted = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (emitted >= totalBytes) {
        controller.close();
        return;
      }
      const size = Math.min(chunk.byteLength, totalBytes - emitted);
      controller.enqueue(chunk.slice(0, size));
      emitted += size;
    },
  });
}

function callArtwork(paramsId: string, query = ""): Promise<Response> {
  const url = `http://localhost/api/jellyfin/artwork/${paramsId}${query}`;
  return getArtwork(new Request(url), {
    params: Promise.resolve({ itemId: paramsId }),
  });
}

function fetchInitHeaders(call: unknown[]): Record<string, string> {
  const init = (call[1] ?? {}) as RequestInit;
  return (init.headers ?? {}) as Record<string, string>;
}

beforeEach(() => {
  vi.stubEnv("JELLYFIN_URL", BASE);
  vi.stubEnv("JELLYFIN_API_KEY", KEY);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GET /api/jellyfin/sessions", () => {
  it("returns normalized JSON with Cache-Control: no-store", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            Id: "s1",
            UserName: "alice",
            Client: "Jellyfin Web",
            DeviceName: "Desktop",
            PlayState: { IsPaused: false, PositionTicks: 0 },
            NowPlayingItem: {
              Id: "m1",
              Name: "Example Movie",
              Type: "Movie",
              RunTimeTicks: 0,
            },
          },
        ]),
      ),
    );

    const res = await getSessions();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = await res.json();
    expect(body.status).toBe("online");
    expect(body.observedAt).toBeTruthy();
    expect(body.counts).toEqual({
      playing: 1,
      paused: 0,
      idle: 0,
      transcoding: 0,
    });
    expect(body.sessions).toHaveLength(1);
  });

  it("returns status unconfigured with zero upstream requests", async () => {
    vi.stubEnv("JELLYFIN_URL", "");
    vi.stubEnv("JELLYFIN_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await getSessions();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect((await res.json()).status).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak the key, upstream URL, or raw session fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse([
          {
            Id: "s1",
            UserName: "alice",
            Client: "Jellyfin Web",
            DeviceName: "Desktop",
            DeviceId: "device-secret",
            UserId: "user-secret",
            RemoteEndPoint: "203.0.113.9",
            Capabilities: { PlayableMediaTypes: ["Video"] },
            NowPlayingItem: {
              Id: "m1",
              Name: "Movie",
              Type: "Movie",
              RunTimeTicks: 0,
            },
          },
        ]),
      ),
    );

    const res = await getSessions();
    const text = await res.text();
    expect(text).not.toContain(KEY);
    expect(text).not.toContain(BASE);
    expect(text).not.toContain("device-secret");
    expect(text).not.toContain("user-secret");
    expect(text).not.toContain("203.0.113.9");
    expect(text).not.toContain("RemoteEndPoint");
    expect(text).not.toContain("DeviceId");
    expect(text).not.toContain("UserId");
  });
});

describe("GET /api/jellyfin/health", () => {
  it("returns diagnostic status and version with no-store", async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (String(url).includes("/System/Info/Public")) {
        return jsonResponse({ Version: "10.11.11" });
      }
      return jsonResponse([]);
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await getHealth();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.json();
    expect(body.status).toBe("online");
    expect(body.version).toBe("10.11.11");
    expect(body.observedAt).toBeTruthy();
  });

  it("returns status unconfigured with zero upstream requests", async () => {
    vi.stubEnv("JELLYFIN_URL", "");
    vi.stubEnv("JELLYFIN_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await getHealth();
    expect((await res.json()).status).toBe("unconfigured");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("disabled short-circuit (fresh config)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "nerve-jellyfin-routes-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns disabled with zero requests when config disables jellyfin", async () => {
    const file = join(dir, "nerve.yaml");
    writeFileSync(
      file,
      ["title: Test", "jellyfin:", "  enabled: false", ""].join("\n"),
      "utf8",
    );

    vi.resetModules();
    vi.stubEnv("NERVE_CONFIG_PATH", file);
    vi.stubEnv("JELLYFIN_URL", BASE);
    vi.stubEnv("JELLYFIN_API_KEY", KEY);

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { GET: sessions } = await import("@/app/api/jellyfin/sessions/route");
    expect((await (await sessions()).json()).status).toBe("disabled");

    const { GET: health } = await import("@/app/api/jellyfin/health/route");
    expect((await (await health()).json()).status).toBe("disabled");

    const { GET: artwork } = await import(
      "@/app/api/jellyfin/artwork/[itemId]/route"
    );
    const artworkRes = await artwork(
      new Request(
        `http://localhost/api/jellyfin/artwork/${ITEM_ID}?tag=${TAG}`,
      ),
      { params: Promise.resolve({ itemId: ITEM_ID }) },
    );
    expect(artworkRes.status).toBe(404);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("GET /api/jellyfin/artwork/[itemId]", () => {
  it("proxies a validated image with content-type, nosniff, and private cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      imageResponse({ contentType: "image/png", buffer: new ArrayBuffer(8) }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const res = await callArtwork(ITEM_ID, `?tag=${TAG}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("private, max-age=86400");

    // The upstream request is a fixed `Items/{id}/Images/Primary` path with
    // server-fixed dimensions/quality; no browser-supplied size params travel.
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain(`/Items/${ITEM_ID}/Images/Primary`);
    expect(url).toContain("maxWidth=600");
    expect(url).toContain("quality=80");
    expect(url).not.toContain("width=");
  });

  it("returns 404 without an upstream call for an invalid item ID", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await callArtwork("../../etc/passwd", `?tag=${TAG}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 without an upstream call for an invalid tag", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await callArtwork(ITEM_ID, "?tag=bad/tag");
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the tag is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await callArtwork(ITEM_ID);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported content types (SVG)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(imageResponse({ contentType: "image/svg+xml" })),
    );

    const res = await callArtwork(ITEM_ID, `?tag=${TAG}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("rejects an oversized declared body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        imageResponse({
          contentType: "image/jpeg",
          contentLength: JELLYFIN_MAX_IMAGE_BYTES + 1,
        }),
      ),
    );

    const res = await callArtwork(ITEM_ID, `?tag=${TAG}`);
    expect(res.status).toBe(404);
  });

  it("aborts an oversized chunked body", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        imageResponse({
          contentType: "image/jpeg",
          stream: chunkedStream(JELLYFIN_MAX_IMAGE_BYTES + 1),
        }),
      ),
    );

    const res = await callArtwork(ITEM_ID, `?tag=${TAG}`);
    expect(res.status).toBe(404);
  });

  it("returns 404 on upstream timeout", async () => {
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

    const promise = callArtwork(ITEM_ID, `?tag=${TAG}`);
    await vi.advanceTimersByTimeAsync(JELLYFIN_TIMEOUT_MS + 1);

    const res = await promise;
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("returns a sanitized 404 on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );

    const res = await callArtwork(ITEM_ID, `?tag=${TAG}`);
    expect(res.status).toBe(404);
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    // No upstream error details leak into the response.
    expect(await res.text()).toBe("");
  });

  it("retries with a server-side token only when auth is required", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(imageResponse({ contentType: "image/jpeg", status: 401 }))
      .mockResolvedValueOnce(
        imageResponse({ contentType: "image/jpeg", buffer: new ArrayBuffer(8) }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await callArtwork(ITEM_ID, `?tag=${TAG}`);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // First attempt carries no key; the retry carries the server-side token.
    expect(fetchInitHeaders(fetchMock.mock.calls[0]).Authorization).toBeUndefined();
    expect(fetchInitHeaders(fetchMock.mock.calls[1]).Authorization).toBe(
      'MediaBrowser Token="secret-key"',
    );

    // The token never reaches the browser response.
    expect(res.headers.get("Authorization")).toBeNull();
    expect(await res.text()).not.toContain(KEY);
  });

  it("returns 404 when auth is required but no key is configured", async () => {
    vi.stubEnv("JELLYFIN_API_KEY", "");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(imageResponse({ contentType: "image/jpeg", status: 401 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await callArtwork(ITEM_ID, `?tag=${TAG}`);
    expect(res.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses to follow redirects and never resends credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(imageResponse({ contentType: "image/jpeg", status: 302 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await callArtwork(ITEM_ID, `?tag=${TAG}`);
    expect(res.status).toBe(404);
    // A redirect is never followed and never triggers the authenticated retry.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchInitHeaders(fetchMock.mock.calls[0]).Authorization).toBeUndefined();
  });
});
