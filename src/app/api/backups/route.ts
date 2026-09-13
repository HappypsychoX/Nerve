import { NextResponse } from "next/server";
import { getContainers } from "@/lib/integrations/docker";
import { getLatestBackupRun, listBackupRuns } from "@/lib/db/backup-runs";
import {
  BACKUP_WATCH_PREFIX,
  deriveBackupStatus,
} from "@/lib/integrations/backup";
import type { BackupRun } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function GET() {
  let dbError: string | null = null;
  let runs: BackupRun[] = [];
  let latest: BackupRun | null = null;

  try {
    runs = listBackupRuns(50);
  } catch (err) {
    dbError = errorMessage(err);
    runs = [];
  }

  try {
    latest = getLatestBackupRun();
  } catch (err) {
    if (dbError === null) dbError = errorMessage(err);
    latest = null;
  }

  let containerStatus: { running: boolean; names: string[] } = {
    running: false,
    names: [],
  };

  try {
    const result = await getContainers();
    if (result.ok) {
      const matched = result.data.filter((c) =>
        c.name.startsWith(BACKUP_WATCH_PREFIX),
      );
      const names = matched.map((c) => c.name);
      const running =
        names.length > 0 && matched.every((c) => c.state === "running");
      containerStatus = { running, names };
    }
  } catch {
    // leave defaults; docker unreachable does not fail the endpoint
  }

  const { health, detail } = deriveBackupStatus(runs, containerStatus);

  return NextResponse.json(
    { latest, runs, containerStatus, health, detail, dbError },
    { headers: { "Cache-Control": "no-store" } },
  );
}
