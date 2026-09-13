import type { BackupRun, BackupSource, BackupStorageStatus } from "@/types";
import type { OffenNotification, OffenStats, OffenStorageStats } from "./types";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function parseDateMs(value: unknown): number | null {
  if (typeof value === "number") return value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function storageStatus(stats: OffenStorageStats | null | undefined): BackupStorageStatus {
  if (!stats) return null;
  const total = toNumber(stats.Total) ?? 0;
  const pruneErrors = toNumber(stats.PruneErrors) ?? 0;
  if (total > 0 && pruneErrors === 0) return "success";
  if (pruneErrors > 0) return "failure";
  if (total === 0) return "skipped";
  return null;
}

function extractNotification(body: unknown): OffenNotification | null {
  const direct = asRecord(body);
  if (!direct) return null;
  if (typeof direct.status === "string") return direct as OffenNotification;

  const message = direct.message;
  if (typeof message === "string") {
    try {
      const parsed = JSON.parse(message);
      const record = asRecord(parsed);
      if (record && typeof record.status === "string") {
        return record as OffenNotification;
      }
    } catch {
      return null;
    }
  }
  return null;
}

export function normalizeBackupPayload(
  body: unknown,
  opts: { source: BackupSource | null; receivedAt: number },
): BackupRun | null {
  const payload = extractNotification(body);
  if (!payload) return null;

  const status = payload.status === "failure" ? "failure" : "success";
  const stats = (payload.stats ?? {}) as OffenStats;

  const parsedStartedAt = parseDateMs(stats.StartTime);
  const endedAt = parseDateMs(stats.EndTime);
  const startedAt = parsedStartedAt ?? opts.receivedAt;

  let durationSeconds: number | null = null;
  const tookTime = toNumber(stats.TookTime);
  if (tookTime !== null && tookTime > 0) {
    durationSeconds = Math.round(tookTime / 1e9);
  } else if (parsedStartedAt !== null && endedAt !== null) {
    const diff = Math.round((endedAt - parsedStartedAt) / 1000);
    durationSeconds = diff >= 0 ? diff : null;
  }

  const containers = stats.Containers;
  const stoppedContainers = toNumber(containers?.Stopped) ?? 0;
  const stopErrors = toNumber(containers?.StopErrors) ?? 0;

  const storages = (stats.Storages ?? {}) as Record<
    string,
    OffenStorageStats | undefined
  >;
  const localStatus = storageStatus(storages.Local);
  const s3Status = storageStatus(storages.S3);

  const error =
    typeof payload.error === "string" && payload.error ? payload.error : null;

  return {
    id: 0,
    status,
    source: opts.source,
    startedAt,
    endedAt,
    durationSeconds,
    filename: typeof stats.BackupFile?.Name === "string" ? stats.BackupFile.Name : null,
    sizeBytes: toNumber(stats.BackupFile?.Size),
    stoppedContainers,
    stopErrors,
    localStatus,
    s3Status,
    error,
    receivedAt: opts.receivedAt,
  };
}
