import { describe, expect, it } from "vitest";
import {
  BACKUP_RECENT_CLOUD_MS,
  BACKUP_RECENT_LOCAL_MS,
  deriveBackupStatus,
  sourceFromContainerName,
} from "@/lib/integrations/backup";
import type { BackupRun } from "@/types";

function makeRun(overrides?: Partial<BackupRun>): BackupRun {
  return {
    id: 1,
    status: "success",
    source: "local",
    startedAt: Date.now() - 1000,
    endedAt: Date.now(),
    durationSeconds: 1,
    filename: "backup.tar.zst",
    sizeBytes: 1024,
    stoppedContainers: 0,
    stopErrors: 0,
    localStatus: "success",
    s3Status: "success",
    error: null,
    receivedAt: Date.now(),
    ...overrides,
  };
}

describe("deriveBackupStatus", () => {
  it("reports tool down when watched containers are not running", () => {
    const result = deriveBackupStatus(
      [],
      { running: false, names: ["volume-backup-local"] },
    );
    expect(result.health).toBe("unknown");
    expect(result.detail).toBe("Backup tool down");
    expect(result.containerDown).toBe(true);
  });

  it("reports no backups recorded when no runs and no watched containers", () => {
    const result = deriveBackupStatus([], { running: false, names: [] });
    expect(result.health).toBe("unknown");
    expect(result.detail).toBe("No backups recorded");
    expect(result.containerDown).toBe(false);
  });

  it("reports failure when latest run failed", () => {
    const run = makeRun({ status: "failure", source: "local" });
    const result = deriveBackupStatus([run], {
      running: true,
      names: ["volume-backup-local"],
    });
    expect(result.health).toBe("degraded");
    expect(result.detail).toBe("Local backup failed");
  });

  it("reports overdue for local threshold", () => {
    const run = makeRun({
      source: "local",
      endedAt: Date.now() - BACKUP_RECENT_LOCAL_MS - 1000,
    });
    const result = deriveBackupStatus([run], {
      running: true,
      names: ["volume-backup-local"],
    });
    expect(result.health).toBe("degraded");
    expect(result.detail).toBe("Local backup overdue");
  });

  it("reports overdue for cloud threshold", () => {
    const run = makeRun({
      source: "cloudflare",
      endedAt: Date.now() - BACKUP_RECENT_CLOUD_MS - 1000,
    });
    const result = deriveBackupStatus([run], {
      running: true,
      names: ["volume-backup-cloudflare"],
    });
    expect(result.health).toBe("degraded");
    expect(result.detail).toBe("Cloud backup overdue");
  });

  it("uses lenient cloud window for unknown source", () => {
    const run = makeRun({
      source: null,
      endedAt: Date.now() - BACKUP_RECENT_LOCAL_MS - 1000,
    });
    const result = deriveBackupStatus([run], {
      running: true,
      names: ["volume-backup-foo"],
    });
    expect(result.health).toBe("healthy");
  });

  it("reports healthy detail with relative timestamp", () => {
    const now = Date.now();
    const run = makeRun({
      source: "local",
      startedAt: now - 60000,
      endedAt: now,
    });
    const result = deriveBackupStatus([run], {
      running: true,
      names: ["volume-backup-local"],
    });
    expect(result.health).toBe("healthy");
    expect(result.detail).toBe("Latest 1m ago");
  });
});

describe("sourceFromContainerName", () => {
  it("returns local for local suffix", () => {
    expect(sourceFromContainerName("volume-backup-local")).toBe("local");
  });

  it("returns cloudflare for cloud suffix", () => {
    expect(sourceFromContainerName("volume-backup-cloudflare")).toBe("cloudflare");
  });

  it("returns null for unrelated names", () => {
    expect(sourceFromContainerName("nginx")).toBeNull();
  });
});
