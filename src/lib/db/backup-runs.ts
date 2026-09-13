import { desc } from "drizzle-orm";
import { getDb } from "./client";
import { backupRuns } from "./schema";
import type { BackupRun } from "@/types";

type BackupRunRow = typeof backupRuns.$inferSelect;

function rowToBackupRun(row: BackupRunRow): BackupRun {
  return {
    id: row.id,
    status: row.status,
    source: row.source,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationSeconds: row.durationSeconds,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    stoppedContainers: row.stoppedContainers,
    stopErrors: row.stopErrors,
    localStatus: row.localStatus,
    s3Status: row.s3Status,
    error: row.error,
    receivedAt: row.receivedAt,
  };
}

export function insertBackupRun(run: Omit<BackupRun, "id">): number {
  const db = getDb();
  const result = db
    .insert(backupRuns)
    .values({
      status: run.status,
      source: run.source,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      durationSeconds: run.durationSeconds,
      filename: run.filename,
      sizeBytes: run.sizeBytes,
      stoppedContainers: run.stoppedContainers,
      stopErrors: run.stopErrors,
      localStatus: run.localStatus,
      s3Status: run.s3Status,
      error: run.error,
      receivedAt: run.receivedAt,
    })
    .run();
  return Number(result.lastInsertRowid);
}

export function listBackupRuns(limit = 50): BackupRun[] {
  const db = getDb();
  const rows = db
    .select()
    .from(backupRuns)
    .orderBy(desc(backupRuns.startedAt))
    .limit(limit)
    .all();
  return rows.map(rowToBackupRun);
}

export function getLatestBackupRun(): BackupRun | null {
  const db = getDb();
  const row = db
    .select()
    .from(backupRuns)
    .orderBy(desc(backupRuns.startedAt))
    .limit(1)
    .get();
  return row ? rowToBackupRun(row) : null;
}
