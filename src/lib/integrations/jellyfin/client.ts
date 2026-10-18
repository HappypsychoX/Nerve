import type { JellyfinPublicInfo, JellyfinSessionUpstream } from "./types";

export const JELLYFIN_TIMEOUT_MS = 5000;
export const JELLYFIN_ACTIVE_WINDOW_SECONDS = 960;
export const JELLYFIN_MAX_IMAGE_BYTES = 2 * 1024 * 1024;
// Server-fixed image constraints: the proxy requests a bounded width and
// quality from Jellyfin so responses stay small and cannot be inflated by
// arbitrary query parameters forwarded from the browser.
export const JELLYFIN_IMAGE_MAX_WIDTH = 600;
export const JELLYFIN_IMAGE_QUALITY = 80;

const JELLYFIN_IMAGE_CONTENT_TYPES: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
];

// Item IDs are 32-char hex or a dashed GUID. Everything else is rejected
// before any upstream request is made.
const ITEM_ID_PATTERN =
  /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

// Image tags are opaque tokens (typically GUIDs). Keep this restrictive so
// path traversal and arbitrary characters never reach an upstream request;
// allow only alphanumerics and dashes.
const IMAGE_TAG_PATTERN = /^[0-9a-zA-Z-]{1,64}$/;

export type JellyfinFetchError =
  | "timeout"
  | "network"
  | "http"
  | "auth"
  | "malformed"
  | "unsupported-type"
  | "oversize";

export type JellyfinFetchResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: JellyfinFetchError; status: number | null };

export type JellyfinImageResult =
  | { ok: true; data: ArrayBuffer; contentType: string }
  | { ok: false; error: JellyfinFetchError; status: number | null };

export function jellyfinBaseUrl(): string | null {
  const url = process.env.JELLYFIN_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

export function jellyfinApiKey(): string | null {
  const key = process.env.JELLYFIN_API_KEY?.trim();
  if (!key) return null;
  return key;
}

export function isValidJellyfinItemId(id: unknown): id is string {
  return typeof id === "string" && ITEM_ID_PATTERN.test(id);
}

export function isValidJellyfinImageTag(tag: unknown): tag is string {
  return typeof tag === "string" && IMAGE_TAG_PATTERN.test(tag);
}

function jellyfinAuthHeader(): Record<string, string> {
  const key = jellyfinApiKey();
  if (!key) return {};
  return { Authorization: `MediaBrowser Token="${key}"` };
}

async function jellyfinFetchJson(
  path: string,
  opts: { auth?: boolean } = {},
): Promise<JellyfinFetchResult<unknown>> {
  const base = jellyfinBaseUrl();
  if (!base) return { ok: false, error: "http", status: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JELLYFIN_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (opts.auth !== false) {
      Object.assign(headers, jellyfinAuthHeader());
    }

    const res = await fetch(`${base}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      redirect: "manual",
      headers,
    });

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "auth", status: res.status };
    }
    // `redirect: "manual"` refuses to follow redirects; a 3xx here means the
    // server asked us to redirect and we declined (so the key never travels).
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, error: "http", status: res.status };
    }
    if (!res.ok) {
      return { ok: false, error: "http", status: res.status };
    }

    try {
      const data: unknown = await res.json();
      return { ok: true, data };
    } catch {
      return { ok: false, error: "malformed", status: res.status };
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "timeout", status: null };
    }
    return { ok: false, error: "network", status: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJellyfinPublicInfo(): Promise<
  JellyfinFetchResult<JellyfinPublicInfo>
> {
  const result = await jellyfinFetchJson("/System/Info/Public", { auth: false });
  if (!result.ok) return result;
  return { ok: true, data: result.data as JellyfinPublicInfo };
}

export async function fetchJellyfinSessions(): Promise<
  JellyfinFetchResult<JellyfinSessionUpstream[]>
> {
  const result = await jellyfinFetchJson(
    `/Sessions?activeWithinSeconds=${JELLYFIN_ACTIVE_WINDOW_SECONDS}`,
  );
  if (!result.ok) return result;
  if (!Array.isArray(result.data)) {
    return { ok: false, error: "malformed", status: 200 };
  }
  return { ok: true, data: result.data as JellyfinSessionUpstream[] };
}

async function readBoundedBody(
  res: Response,
  maxBytes: number,
): Promise<
  | { ok: true; data: ArrayBuffer }
  | { ok: false; error: "oversize" | "network" }
> {
  const declared = res.headers.get("content-length");
  if (declared) {
    const size = Number(declared);
    if (Number.isFinite(size) && size > maxBytes) {
      return { ok: false, error: "oversize" };
    }
  }

  if (!res.body) {
    try {
      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > maxBytes) return { ok: false, error: "oversize" };
      return { ok: true, data: buffer };
    } catch {
      return { ok: false, error: "network" };
    }
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, error: "oversize" };
        }
        chunks.push(value);
      }
    }
  } catch {
    return { ok: false, error: "network" };
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, data: combined.buffer };
}

async function fetchPrimaryImageOnce(
  itemId: string,
  tag: string,
  withAuth: boolean,
): Promise<JellyfinImageResult> {
  const base = jellyfinBaseUrl();
  if (!base) return { ok: false, error: "http", status: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), JELLYFIN_TIMEOUT_MS);

  try {
    const res = await fetch(
      `${base}/Items/${itemId}/Images/Primary?tag=${encodeURIComponent(tag)}&maxWidth=${JELLYFIN_IMAGE_MAX_WIDTH}&quality=${JELLYFIN_IMAGE_QUALITY}`,
      {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        redirect: "manual",
        headers: withAuth ? jellyfinAuthHeader() : undefined,
      },
    );

    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "auth", status: res.status };
    }
    if (res.status >= 300 && res.status < 400) {
      return { ok: false, error: "http", status: res.status };
    }
    if (!res.ok) {
      return { ok: false, error: "http", status: res.status };
    }

    const rawContentType = res.headers.get("content-type") ?? "";
    const contentType = rawContentType.split(";")[0].trim().toLowerCase();
    if (!JELLYFIN_IMAGE_CONTENT_TYPES.includes(contentType)) {
      return { ok: false, error: "unsupported-type", status: res.status };
    }

    const body = await readBoundedBody(res, JELLYFIN_MAX_IMAGE_BYTES);
    if (!body.ok) {
      return { ok: false, error: body.error, status: res.status };
    }
    return { ok: true, data: body.data, contentType };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "timeout", status: null };
    }
    return { ok: false, error: "network", status: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchJellyfinPrimaryImage(
  itemId: unknown,
  tag: unknown,
): Promise<JellyfinImageResult> {
  if (!isValidJellyfinItemId(itemId) || !isValidJellyfinImageTag(tag)) {
    return { ok: false, error: "http", status: null };
  }

  // Artwork is normally served without authentication; try that first so the
  // API key is not attached unnecessarily. If the server requires auth (401 or
  // 403), retry with the server-side token only — the key never leaves the
  // server and redirects are never followed.
  const unauthenticated = await fetchPrimaryImageOnce(itemId, tag, false);
  if (unauthenticated.ok) return unauthenticated;
  if (unauthenticated.error !== "auth") return unauthenticated;

  if (!jellyfinApiKey()) return unauthenticated;
  return fetchPrimaryImageOnce(itemId, tag, true);
}
