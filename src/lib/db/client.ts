import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

export function resolveDbPath(): string {
  return process.env.NERVE_DATABASE_PATH?.trim() || "/app/data/nerve.db";
}

const BACKUP_RUNS_DDL = `
CREATE TABLE IF NOT EXISTS backup_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL,
  source TEXT,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  duration_seconds INTEGER,
  filename TEXT,
  size_bytes INTEGER,
  stopped_containers INTEGER NOT NULL DEFAULT 0,
  stop_errors INTEGER NOT NULL DEFAULT 0,
  local_status TEXT,
  s3_status TEXT,
  error TEXT,
  received_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS backup_runs_started_at_idx ON backup_runs (started_at);
CREATE INDEX IF NOT EXISTS backup_runs_source_idx ON backup_runs (source);
`;

export type NerveDatabase = BetterSQLite3Database<typeof schema>;

let cachedDb: NerveDatabase | null = null;

export function ensureSchema(sqlite: Database.Database): void {
  sqlite.exec(BACKUP_RUNS_DDL);
}

export function getDb(): NerveDatabase {
  if (cachedDb) return cachedDb;
  const file = resolveDbPath();
  mkdirSync(dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  ensureSchema(sqlite);
  cachedDb = drizzle(sqlite, { schema });
  return cachedDb;
}
