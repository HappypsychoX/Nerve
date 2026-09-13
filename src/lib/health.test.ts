import { describe, expect, it } from "vitest";
import {
  computeOverallHealth,
  containerDisplayStatus,
  containerStateLabel,
  summarizeServices,
} from "@/lib/health";
import type { OverallHealthInput } from "@/lib/health";


describe("computeOverallHealth", () => {
  const base: OverallHealthInput = {
    docker: "healthy",
    criticalServices: [],
    backup: "unknown",
    vpn: "unknown",
    criticalContainers: { stopped: 0, unhealthy: 0, restarting: 0 },
  };

  it("short-circuits to offline when docker is offline", () => {
    expect(computeOverallHealth({ ...base, docker: "offline" })).toBe("offline");
  });

  it("short-circuits to unknown when docker is unknown", () => {
    expect(computeOverallHealth({ ...base, docker: "unknown" })).toBe("unknown");
  });

  it("returns degraded for stopped critical container", () => {
    expect(
      computeOverallHealth({
        ...base,
        criticalContainers: { stopped: 1, unhealthy: 0, restarting: 0 },
      }),
    ).toBe("degraded");
  });

  it("returns degraded for unhealthy critical container", () => {
    expect(
      computeOverallHealth({
        ...base,
        criticalContainers: { stopped: 0, unhealthy: 1, restarting: 0 },
      }),
    ).toBe("degraded");
  });

  it("returns degraded for restarting critical container", () => {
    expect(
      computeOverallHealth({
        ...base,
        criticalContainers: { stopped: 0, unhealthy: 0, restarting: 1 },
      }),
    ).toBe("degraded");
  });

  it("returns degraded for offline critical service", () => {
    expect(
      computeOverallHealth({ ...base, criticalServices: ["offline"] }),
    ).toBe("degraded");
  });

  it("returns degraded for degraded critical service", () => {
    expect(
      computeOverallHealth({ ...base, criticalServices: ["degraded"] }),
    ).toBe("degraded");
  });

  it("returns degraded when vpn is degraded", () => {
    expect(computeOverallHealth({ ...base, vpn: "degraded" })).toBe("degraded");
  });

  it("returns degraded when vpn is offline", () => {
    expect(computeOverallHealth({ ...base, vpn: "offline" })).toBe("degraded");
  });

  it("returns degraded when backup is degraded", () => {
    expect(computeOverallHealth({ ...base, backup: "degraded" })).toBe("degraded");
  });

  it("returns healthy when everything is healthy", () => {
    expect(computeOverallHealth({ ...base, backup: "healthy", vpn: "healthy" })).toBe(
      "healthy",
    );
  });

  it("does not degrade on unknown vpn or backup", () => {
    expect(computeOverallHealth({ ...base })).toBe("healthy");
  });
});

describe("containerDisplayStatus", () => {
  it("maps running+healthy to healthy", () => {
    expect(containerDisplayStatus("running", "healthy")).toBe("healthy");
  });

  it("maps running+none to healthy", () => {
    expect(containerDisplayStatus("running", "none")).toBe("healthy");
  });

  it("maps running+unhealthy to degraded", () => {
    expect(containerDisplayStatus("running", "unhealthy")).toBe("degraded");
  });

  it("maps running+starting to degraded", () => {
    expect(containerDisplayStatus("running", "starting")).toBe("degraded");
  });

  it("maps restarting to degraded", () => {
    expect(containerDisplayStatus("restarting", "none")).toBe("degraded");
  });

  it("maps stopped to offline", () => {
    expect(containerDisplayStatus("stopped", "none")).toBe("offline");
  });

  it("maps unknown to unknown", () => {
    expect(containerDisplayStatus("unknown", "none")).toBe("unknown");
  });
});

describe("containerStateLabel", () => {
  it("prefers health labels", () => {
    expect(containerStateLabel("running", "healthy")).toBe("healthy");
    expect(containerStateLabel("running", "unhealthy")).toBe("unhealthy");
    expect(containerStateLabel("running", "starting")).toBe("starting");
  });

  it("falls back to state labels", () => {
    expect(containerStateLabel("restarting", "none")).toBe("restarting");
    expect(containerStateLabel("stopped", "none")).toBe("stopped");
    expect(containerStateLabel("running", "none")).toBe("running");
    expect(containerStateLabel("unknown", "none")).toBe("unknown");
  });
});

describe("summarizeServices", () => {
  it("reports unknown when empty", () => {
    expect(summarizeServices([])).toEqual({
      health: "unknown",
      detail: "No services configured",
    });
  });

  it("reports unknown when none checked", () => {
    expect(summarizeServices([{ health: "unknown" }])).toEqual({
      health: "unknown",
      detail: "Not checked",
    });
  });

  it("reports healthy when all online", () => {
    expect(
      summarizeServices([{ health: "online" }, { health: "online" }]),
    ).toEqual({ health: "healthy", detail: "2/2 online" });
  });

  it("reports offline when none online", () => {
    expect(
      summarizeServices([{ health: "offline" }, { health: "offline" }]),
    ).toEqual({ health: "offline", detail: "0/2 online" });
  });

  it("reports degraded for mixed", () => {
    expect(
      summarizeServices([{ health: "online" }, { health: "offline" }]),
    ).toEqual({ health: "degraded", detail: "1/2 online" });
  });
});
