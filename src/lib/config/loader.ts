import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import type {
  NerveConfig,
  ServiceConfig,
  ServiceGroupConfig,
} from "./types";

const DEFAULT_GROUPS: ServiceGroupConfig[] = [
  { id: "media", name: "Media" },
  { id: "downloads", name: "Downloads" },
  { id: "infrastructure", name: "Infrastructure" },
  { id: "monitoring", name: "Monitoring / Maintenance" },
  { id: "remote-access", name: "Remote Access" },
  { id: "other", name: "Other" },
];

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
  };

  cached = config;
  return config;
}

export function getQuickLinks(config: NerveConfig): ServiceConfig[] {
  return config.services.filter((service) => Boolean(service.url));
}
