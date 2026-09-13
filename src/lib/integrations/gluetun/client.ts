export const GLUETUN_TIMEOUT_MS = 5000;

export type GluetunFetchError = "timeout" | "network" | "http" | "auth";

export type GluetunFetchResult =
  | { ok: true; data: unknown }
  | { ok: false; error: GluetunFetchError; status: number | null };

export function gluetunBaseUrl(): string | null {
  const url = process.env.GLUETUN_URL?.trim();
  if (!url) return null;
  return url.replace(/\/+$/, "");
}

export function gluetunApiKey(): string | null {
  const key = process.env.GLUETUN_API_KEY?.trim();
  if (!key) return null;
  return key;
}

function gluetunAuthHeader(): Record<string, string> {
  const key = gluetunApiKey();
  if (!key) return {};
  return { "X-API-Key": key };
}

async function gluetunFetch(
  path: string,
  timeoutMs: number = GLUETUN_TIMEOUT_MS,
): Promise<GluetunFetchResult> {
  const base = gluetunBaseUrl();
  if (!base) return { ok: false, error: "http", status: null };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path}`, {
      method: "GET",
      cache: "no-store",
      signal: controller.signal,
      headers: gluetunAuthHeader(),
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

export async function fetchGluetunVpnStatus(): Promise<GluetunFetchResult> {
  return gluetunFetch("/v1/vpn/status");
}

export async function fetchGluetunPublicIp(): Promise<GluetunFetchResult> {
  return gluetunFetch("/v1/publicip/ip");
}
