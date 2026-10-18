import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type {
  JellyfinDisplayConfig,
  NerveConfig,
  ServiceConfig,
  ServiceGroupConfig,
} from "./types";
import { DEFAULT_JELLYFIN_DISPLAY } from "./types";

const DEFAULT_GROUPS: ServiceGroupConfig[] = [
  { id: "media", name: "Media" },
  { id: "downloads", name: "Downloads" },
  { id: "infrastructure", name: "Infrastructure" },
  { id: "monitoring", name: "Monitoring / Maintenance" },
  { id: "remote-access", name: "Remote Access" },
  { id: "other", name: "Other" },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

// Parses the display-only `jellyfin` block with strict type guards. Unknown
// keys (including any smuggled `url`, `apiKey`, or `refreshIntervalSeconds`)
// are dropped; missing or malformed values fall back to the defaults.
export function parseJellyfinBlock(value: unknown): JellyfinDisplayConfig {
  const block = asRecord(value);
  if (!block) return { ...DEFAULT_JELLYFIN_DISPLAY };
  return {
    enabled:
      typeof block.enabled === "boolean"
        ? block.enabled
        : DEFAULT_JELLYFIN_DISPLAY.enabled,
    showPosters:
      typeof block.showPosters === "boolean"
        ? block.showPosters
        : DEFAULT_JELLYFIN_DISPLAY.showPosters,
    showIdleClients:
      typeof block.showIdleClients === "boolean"
        ? block.showIdleClients
        : DEFAULT_JELLYFIN_DISPLAY.showIdleClients,
  };
}

function resolveConfigPath(): string {
  const override = process.env.NERVE_CONFIG_PATH;
  if (override) return path.resolve(override);

  const runtime = path.join(process.cwd(), "config", "nerve.yaml");
  if (existsSync(runtime)) return runtime;

  return path.join(process.cwd(), "config", "opNervexample.yaml");
}

function parseConfigFile(filePath: string): Partial<NerveConfig> {
  const raw = readFileSync(filePath, "utf8");
  const doc = parse(raw) as Record<string, unknown> | null;

  if (!doc || typeof doc !== "object") return {};

  return {
    title: typeof doc.title === "string" ? doc.title : undefined,
    serverName:
      typeof doc.serverName === "string" ? doc.serverName : undefined,
    groups: Array.isArray(doc.groups) ? (doc.groups as ServiceGroupConfig[]) : undefined,
    services: Array.isArray(doc.services) ? (doc.services as ServiceConfig[]) : undefined,
    jellyfin: parseJellyfinBlock(doc.jellyfin),
  };
}

function normalizeServices(
  services: ServiceConfig[] | undefined,
): ServiceConfig[] {
  if (!Array.isArray(services)) return [];
  return services.filter(
    (service): service is ServiceConfig =>
      typeof service === "object" &&
      service !== null &&
      typeof service.id === "string" &&
      typeof service.name === "string" &&
      typeof service.group === "string",
  );
}

let cached: NerveConfig | null = null;

export function loadConfig(): NerveConfig {
  if (cached) return cached;

  const filePath = resolveConfigPath();
  let file: Partial<NerveConfig> = {};

  try {
    file = parseConfigFile(filePath);
  } catch (error) {
    console.warn(
      `[config] unable to load ${filePath}, using defaults`,
      error instanceof Error ? error.message : error,
    );
  }

  const config: NerveConfig = {
    title: process.env.NERVE_TITLE || file.title || "Nerve",
    serverName:
      process.env.NERVE_SERVER_NAME || file.serverName || "Home Server",
    groups: file.groups && file.groups.length > 0 ? file.groups : DEFAULT_GROUPS,
    services: normalizeServices(file.services),
    jellyfin: file.jellyfin ?? parseJellyfinBlock(undefined),
  };

  cached = config;
  return config;
}

export function getQuickLinks(config: NerveConfig): ServiceConfig[] {
  return config.services.filter((service) => Boolean(service.url));
}
