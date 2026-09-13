import { describe, expect, it } from "vitest";
import {
  composeDockerSummary,
  summarizeContainers,
} from "@/lib/docker-summary";
import type { ContainerStatus, DockerSummary } from "@/types";
import type {
  DockerContainersResponse,
  DockerSystemResponse,
} from "@/lib/integrations/docker/types";

function makeContainer(overrides?: Partial<ContainerStatus>): ContainerStatus {
  return {
    id: "c1",
    name: "test",
    image: "img",
    state: "running",
    health: "healthy",
    uptimeSeconds: 0,
    restartCount: 0,
    cpuPercent: null,
    memoryBytes: null,
    ...overrides,
  };
}

describe("summarizeContainers", () => {
  it("counts running and stopped", () => {
    const containers = [
      makeContainer({ state: "running" }),
      makeContainer({ state: "running" }),
      makeContainer({ state: "stopped" }),
    ];
    expect(summarizeContainers(containers).counts).toEqual({
      running: 2,
      stopped: 1,
      unhealthy: 0,
    });
  });

  it("counts unhealthy", () => {
    const containers = [
      makeContainer({ health: "unhealthy" }),
      makeContainer({ health: "healthy" }),
    ];
    expect(summarizeContainers(containers).counts.unhealthy).toBe(1);
  });

  it("aggregates cpu and memory", () => {
    const containers = [
      makeContainer({ cpuPercent: 10.5, memoryBytes: 1024 }),
      makeContainer({ cpuPercent: 20.5, memoryBytes: 2048 }),
    ];
    const { aggregate } = summarizeContainers(containers);
    expect(aggregate.cpuPercent).toBe(31);
    expect(aggregate.memoryUsedBytes).toBe(3072);
  });

  it("clamps cpu to 100", () => {
    const containers = [makeContainer({ cpuPercent: 150 })];
    expect(summarizeContainers(containers).aggregate.cpuPercent).toBe(100);
  });

  it("returns null for missing metrics", () => {
    const containers = [makeContainer()];
    const { aggregate } = summarizeContainers(containers);
    expect(aggregate.cpuPercent).toBeNull();
    expect(aggregate.memoryUsedBytes).toBeNull();
  });
});

describe("composeDockerSummary", () => {
  it("maps containers and system fields", () => {
    const containers: DockerContainersResponse = {
      health: "healthy",
      containers: [],
      counts: { running: 3, stopped: 1, unhealthy: 0 },
      aggregate: { cpuPercent: 12.5, memoryUsedBytes: 1000 },
      criticalCounts: { stopped: 0, unhealthy: 0, restarting: 0 },
    };
    const system: DockerSystemResponse = {
      health: "healthy",
      version: "27.0",
      images: 42,
      memoryTotalBytes: 16000,
      diskUsedBytes: 8000,
      diskReclaimableBytes: 2000,
    };
    const expected: DockerSummary = {
      cpuPercent: 12.5,
      memoryUsedBytes: 1000,
      memoryTotalBytes: 16000,
      diskUsedBytes: 8000,
      diskReclaimableBytes: 2000,
      running: 3,
      stopped: 1,
      unhealthy: 0,
      images: 42,
      version: "27.0",
    };
    expect(composeDockerSummary(containers, system)).toEqual(expected);
  });
});
