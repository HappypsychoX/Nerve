import { describe, expect, it } from "vitest";
import {
  containerGroupForName,
  isCriticalContainer,
  matchServiceForContainer,
  matchUpdateForContainer,
  normalizeContainerName,
} from "@/lib/config";
import type { ServiceConfig, ServiceGroup } from "@/lib/config";
import type { ContainerUpdate } from "@/types";

function makeService(overrides?: Partial<ServiceConfig>): ServiceConfig {
  return {
    id: "jellyfin",
    name: "Jellyfin",
    url: "http://jellyfin:8096",
    group: "media",
    critical: false,
    ...overrides,
  };
}

describe("normalizeContainerName", () => {
  it("strips leading slash, trims, and lowercases", () => {
    expect(normalizeContainerName("  /Jellyfin  ")).toBe("jellyfin");
  });

  it("leaves plain names unchanged", () => {
    expect(normalizeContainerName("jellyfin")).toBe("jellyfin");
  });
});

describe("matchServiceForContainer", () => {
  it("matches exact id", () => {
    const services = [makeService()];
    expect(matchServiceForContainer(services, "jellyfin")?.id).toBe("jellyfin");
  });

  it("matches compose prefix", () => {
    const services = [makeService()];
    expect(matchServiceForContainer(services, "media-jellyfin-1")?.id).toBe(
      "jellyfin",
    );
  });

  it("matches hostname from url", () => {
    const services = [makeService({ id: "radarr", url: "http://radarr:7878" })];
    expect(matchServiceForContainer(services, "radarr")?.id).toBe("radarr");
  });

  it("prefers longest id match", () => {
    const services = [
      makeService({ id: "jelly" }),
      makeService({ id: "jellyseerr" }),
    ];
    expect(matchServiceForContainer(services, "jellyseerr")?.id).toBe(
      "jellyseerr",
    );
  });

  it("returns null when no match", () => {
    expect(matchServiceForContainer([], "nginx")).toBeNull();
  });
});

describe("containerGroupForName", () => {
  it("returns matched group or other", () => {
    const services = [makeService({ group: "media" as ServiceGroup })];
    expect(containerGroupForName(services, "jellyfin")).toBe("media");
    expect(containerGroupForName(services, "nginx")).toBe("other");
  });
});

describe("isCriticalContainer", () => {
  it("returns true for critical matched service", () => {
    const services = [makeService({ critical: true })];
    expect(isCriticalContainer(services, "jellyfin", "gluetun")).toBe(true);
  });

  it("returns true for gluetun container", () => {
    expect(isCriticalContainer([], "gluetun", "gluetun")).toBe(true);
  });

  it("returns true for backup watch prefix", () => {
    expect(isCriticalContainer([], "volume-backup-local", "gluetun")).toBe(true);
  });

  it("returns false otherwise", () => {
    const services = [makeService()];
    expect(isCriticalContainer(services, "nginx", "gluetun")).toBe(false);
  });
});

describe("matchUpdateForContainer", () => {
  it("matches exact container name", () => {
    const updates: ContainerUpdate[] = [
      {
        containerId: "u1",
        containerName: "jellyfin",
        currentVersion: "1.0",
        availableVersion: "2.0",
        updateAvailable: true,
      },
    ];
    const match = matchUpdateForContainer(updates, "jellyfin");
    expect(match).toEqual({
      updateAvailable: true,
      currentVersion: "1.0",
      availableVersion: "2.0",
    });
  });

  it("falls back to suffix match", () => {
    const updates: ContainerUpdate[] = [
      {
        containerId: "u1",
        containerName: "jellyfin",
        currentVersion: "1.0",
        availableVersion: "2.0",
        updateAvailable: true,
      },
    ];
    const match = matchUpdateForContainer(updates, "media-jellyfin");
    expect(match?.updateAvailable).toBe(true);
  });

  it("returns null when no match", () => {
    expect(matchUpdateForContainer([], "nginx")).toBeNull();
  });
});
