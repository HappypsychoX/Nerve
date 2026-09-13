import { formatRelative } from "@/lib/utils";
import type { BackupRun, BackupSource, IntegrationHealth } from "@/types";

export const BACKUP_WATCH_PREFIX = "volume-backup-";
export const BACKUP_RECENT_LOCAL_MS = 26 * 60 * 60 * 1000;
export const BACKUP_RECENT_CLOUD_MS = 8 * 24 * 60 * 60 * 1000;

type EffectiveSource = BackupSource | "unknown";

function labelFor(source: EffectiveSource): string {
  if (source === "local") return "Local backup";
  if (source === "cloudflare") return "Cloud backup";
  return "Backup";
}

// Runs without a known source (no X-Nerve-Source header) are evaluated with the
// lenient weekly window so a weekly schedule is never falsely flagged overdue.
function thresholdFor(source: EffectiveSource): number {
  if (source === "local") return BACKUP_RECENT_LOCAL_MS;
  return BACKUP_RECENT_CLOUD_MS;
}

export function sourceFromContainerName(name: string): BackupSource | null {
  const trimmed = name.trim();
  if (!trimmed.startsWith(BACKUP_WATCH_PREFIX)) return null;
  const suffix = trimmed.slice(BACKUP_WATCH_PREFIX.length).toLowerCase();
  if (suffix.includes("cloud")) return "cloudflare";
  if (suffix.includes("local")) return "local";
  return null;
}

export function deriveBackupStatus(
  runs: BackupRun[],
  containerStatus: { running: boolean; names: string[] },
  now = Date.now(),
): { health: IntegrationHealth; detail: string; containerDown: boolean } {
  const names = containerStatus.names;

  if (names.length > 0 && !containerStatus.running) {
    return { health: "unknown", detail: "Backup tool down", containerDown: true };
  }
  if (names.length === 0 && runs.length === 0) {
    return { health: "unknown", detail: "No backups recorded", containerDown: false };
  }
  if (names.length === 0 && runs.length > 0) {
    return { health: "unknown", detail: "Backup tool down", containerDown: true };
  }
  if (runs.length === 0) {
    return { health: "unknown", detail: "No backups recorded", containerDown: false };
  }

  const sources = new Set<EffectiveSource>();
  for (const run of runs) {
    sources.add(run.source ?? "unknown");
  }
  for (const name of names) {
    const source = sourceFromContainerName(name);
    if (source) sources.add(source);
  }

  let anyHealthy = false;
  let degradedDetail: string | null = null;
  let latestHealthyStartedAt: number | null = null;

  for (const source of sources) {
    const sourceRuns = runs.filter((run) => (run.source ?? "unknown") === source);
    const latest = sourceRuns[0];
    if (!latest) continue;

    if (latest.status === "failure") {
      if (degradedDetail === null) degradedDetail = `${labelFor(source)} failed`;
      continue;
    }

    const age = now - (latest.endedAt ?? latest.startedAt);
    if (age > thresholdFor(source)) {
      if (degradedDetail === null) degradedDetail = `${labelFor(source)} overdue`;
      continue;
    }

    anyHealthy = true;
    if (latestHealthyStartedAt === null || latest.startedAt > latestHealthyStartedAt) {
      latestHealthyStartedAt = latest.startedAt;
    }
  }

  if (degradedDetail !== null) {
    return { health: "degraded", detail: degradedDetail, containerDown: false };
  }
  if (anyHealthy) {
    const detail =
      latestHealthyStartedAt !== null
        ? `Latest ${formatRelative(latestHealthyStartedAt, now)}`
        : "Healthy";
    return { health: "healthy", detail, containerDown: false };
  }
  return { health: "unknown", detail: "No backups recorded", containerDown: false };
}
