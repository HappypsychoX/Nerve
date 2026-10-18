import { DEFAULT_JELLYFIN_DISPLAY, loadConfig } from "@/lib/config";
import type { JellyfinDisplayConfig } from "@/lib/config";
import {
  fetchJellyfinPublicInfo,
  fetchJellyfinSessions,
  jellyfinApiKey,
  jellyfinBaseUrl,
} from "./client";
import type { JellyfinFetchError } from "./client";
import { deriveCounts, normalizeSessions, sortSessions } from "./normalize";
import type {
  JellyfinCounts,
  JellyfinHealthResponse,
  JellyfinPublicInfo,
  JellyfinSessionsResponse,
  JellyfinStatus,
} from "./types";

const EMPTY_COUNTS: JellyfinCounts = {
  playing: 0,
  paused: 0,
  idle: 0,
  transcoding: 0,
};

// Maps internal fetch errors to the public status union. Timeout/network mean
// the server could not be reached ("offline"); auth means a bad key
// ("unauthorized"); everything else is an unexpected upstream response.
export function mapJellyfinErrorToStatus(
  error: JellyfinFetchError,
): JellyfinStatus {
  switch (error) {
    case "auth":
      return "unauthorized";
    case "timeout":
    case "network":
      return "offline";
    case "http":
    case "malformed":
    case "unsupported-type":
    case "oversize":
      return "error";
  }
}

function emptySessionsResponse(status: JellyfinStatus): JellyfinSessionsResponse {
  return {
    status,
    observedAt: null,
    counts: { ...EMPTY_COUNTS },
    sessions: [],
  };
}

function parseVersion(payload: JellyfinPublicInfo): string | null {
  const version = payload?.Version;
  return typeof version === "string" && version.trim() !== ""
    ? version.trim()
    : null;
}

export async function getJellyfinSessions(
  config: JellyfinDisplayConfig = loadConfig().jellyfin ??
    DEFAULT_JELLYFIN_DISPLAY,
): Promise<JellyfinSessionsResponse> {
  // Short-circuit before any network request.
  if (!config.enabled) return emptySessionsResponse("disabled");
  if (!jellyfinBaseUrl() || !jellyfinApiKey()) {
    return emptySessionsResponse("unconfigured");
  }

  const result = await fetchJellyfinSessions();
  if (!result.ok) {
    return emptySessionsResponse(mapJellyfinErrorToStatus(result.error));
  }

  const sessions = sortSessions(
    normalizeSessions(result.data, { showPosters: config.showPosters }),
  );

  return {
    status: "online",
    observedAt: new Date().toISOString(),
    counts: deriveCounts(sessions),
    sessions,
  };
}

export async function getJellyfinHealth(
  config: JellyfinDisplayConfig = loadConfig().jellyfin ??
    DEFAULT_JELLYFIN_DISPLAY,
): Promise<JellyfinHealthResponse> {
  if (!config.enabled) {
    return { status: "disabled", version: null, observedAt: null };
  }
  if (!jellyfinBaseUrl() || !jellyfinApiKey()) {
    return { status: "unconfigured", version: null, observedAt: null };
  }

  const [infoResult, sessionsResult] = await Promise.allSettled([
    fetchJellyfinPublicInfo(),
    fetchJellyfinSessions(),
  ]);

  // Public info succeeds even with a bad key, so a version can still be shown
  // alongside an auth failure; only /Sessions establishes key validity.
  const version =
    infoResult.status === "fulfilled" && infoResult.value.ok
      ? parseVersion(infoResult.value.data)
      : null;

  const observedAt = new Date().toISOString();

  if (sessionsResult.status === "rejected") {
    return { status: "error", version, observedAt };
  }

  const sessions = sessionsResult.value;
  if (sessions.ok) {
    return { status: "online", version, observedAt };
  }

  return { status: mapJellyfinErrorToStatus(sessions.error), version, observedAt };
}
