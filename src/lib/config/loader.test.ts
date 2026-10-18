import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseJellyfinBlock } from "@/lib/config/loader";

describe("parseJellyfinBlock", () => {
  it("returns defaults when the block is absent", () => {
    expect(parseJellyfinBlock(undefined)).toEqual({
      enabled: true,
      showPosters: true,
      showIdleClients: true,
    });
    expect(parseJellyfinBlock(null)).toEqual({
      enabled: true,
      showPosters: true,
      showIdleClients: true,
    });
  });

  it("parses a present block", () => {
    expect(
      parseJellyfinBlock({
        enabled: false,
        showPosters: false,
        showIdleClients: true,
      }),
    ).toEqual({ enabled: false, showPosters: false, showIdleClients: true });
  });

  it("defaults malformed values with strict type guards", () => {
    expect(
      parseJellyfinBlock({
        enabled: "yes",
        showPosters: 1,
        showIdleClients: "no",
      }),
    ).toEqual({ enabled: true, showPosters: true, showIdleClients: true });
  });

  it("drops unknown keys including url, apiKey, and refreshIntervalSeconds", () => {
    const parsed = parseJellyfinBlock({
      enabled: true,
      url: "http://jellyfin:8096",
      apiKey: "super-secret",
      refreshIntervalSeconds: 5,
    });
    expect(parsed).toEqual({ enabled: true, showPosters: true, showIdleClients: true });
    expect(parsed).not.toHaveProperty("url");
    expect(parsed).not.toHaveProperty("apiKey");
    expect(parsed).not.toHaveProperty("refreshIntervalSeconds");
  });
});

describe("loadConfig jellyfin block", () => {
  let dir: string;

  beforeEach(() => {
    vi.resetModules();
    dir = mkdtempSync(join(tmpdir(), "nerve-config-"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(dir, { recursive: true, force: true });
  });

  it("parses the jellyfin block and never exposes url or apiKey", async () => {
    const file = join(dir, "nerve.yaml");
    writeFileSync(
      file,
      [
        "title: Test",
        "jellyfin:",
        "  enabled: false",
        "  showPosters: false",
        "  showIdleClients: true",
        "  url: http://jellyfin:8096",
        "  apiKey: super-secret",
        "",
      ].join("\n"),
      "utf8",
    );
    vi.stubEnv("NERVE_CONFIG_PATH", file);

    const { loadConfig } = await import("@/lib/config");
    const config = loadConfig();

    expect(config.jellyfin).toEqual({
      enabled: false,
      showPosters: false,
      showIdleClients: true,
    });
    expect(JSON.stringify(config.jellyfin)).not.toContain("super-secret");
    expect(JSON.stringify(config.jellyfin)).not.toContain("http://jellyfin");
    expect(config.jellyfin).not.toHaveProperty("url");
    expect(config.jellyfin).not.toHaveProperty("apiKey");
  });

  it("defaults the jellyfin block when it is absent", async () => {
    const file = join(dir, "nerve.yaml");
    writeFileSync(file, "title: Test\n", "utf8");
    vi.stubEnv("NERVE_CONFIG_PATH", file);

    const { loadConfig } = await import("@/lib/config");
    const config = loadConfig();

    expect(config.jellyfin).toEqual({
      enabled: true,
      showPosters: true,
      showIdleClients: true,
    });
  });
});
