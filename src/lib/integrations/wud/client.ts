export const WUD_TIMEOUT_MS = 10000;

export type WudFetchError = "timeout" | "network" | "http" | "auth";

export type WudFetchResult =
  | { ok: true; data: unknown }
  | { ok: false; error: WudFetchError; status: number | null };

export function wudBaseUrl(): string | null {
  const url = process.env.WUD_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

export function wudAuthHeader(): Record<string, string> {
  const username = process.env.WUD_USERNAME?.trim();
  if (!username) return {};
  const token = Buffer.from(
    `${username}:${process.env.WUD_PASSWORD ?? ""}`,
  ).toString("base64");
  return { Authorization: `Basic ${token}` };
}

async function wudFetch(
  path: string,
  timeoutMs: number = WUD_TIMEOUT_MS,
): Promise<WudFetchResult> {
  const base = wudBaseUrl();
  if (!base) return { ok: false, error: "http", status: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: wudAuthHeader(),
    });
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: "auth", status: res.status };
    }
    if (!res.ok) return { ok: false, error: "http", status: res.status };
    return { ok: true, data: await res.json() };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "timeout", status: null };
    }
    return { ok: false, error: "network", status: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchWudContainers(): Promise<WudFetchResult> {
  const result = await wudFetch("/api/containers");
  if (result.ok) return result;
  if (result.status === 404) return wudFetch("/api/registry");
  return result;
}
