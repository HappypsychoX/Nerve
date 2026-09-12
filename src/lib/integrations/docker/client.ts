export const DEFAULT_DOCKER_HOST = "tcp://socket-proxy:2375";
export const DOCKER_TIMEOUT_MS = 5000;
export const DOCKER_HEALTH_TIMEOUT_MS = 3000;

export function dockerBaseUrl(): string {
  const host = process.env.DOCKER_HOST || DEFAULT_DOCKER_HOST;
  if (host.startsWith("tcp://")) return `http://${host.slice("tcp://".length)}`;
  if (host.startsWith("http://") || host.startsWith("https://")) return host;
  // unix:// and npipe:// unsupported in M1
  throw new Error(`Unsupported DOCKER_HOST scheme: ${host}`);
}

export type DockerFetchError = "timeout" | "network" | "http";

export async function dockerFetch(
  path: string,
  timeoutMs: number = DOCKER_TIMEOUT_MS,
): Promise<{ ok: true; data: unknown } | { ok: false; error: DockerFetchError }> {
  let url: string;
  try {
    url = dockerBaseUrl() + path;
  } catch {
    return { ok: false, error: "network" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store", method: "GET" });
    if (!res.ok) return { ok: false, error: "http" };
    return { ok: true, data: await res.json() };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return { ok: false, error: "timeout" };
    return { ok: false, error: "network" };
  } finally {
    clearTimeout(timer);
  }
}
