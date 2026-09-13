import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const backupRuns = sqliteTable(
  "backup_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    status: text("status", { enum: ["success", "failure"] }).notNull(),
    source: text("source", { enum: ["local", "cloudflare"] }),
    startedAt: integer("started_at").notNull(),
    endedAt: integer("ended_at"),
    durationSeconds: integer("duration_seconds"),
    filename: text("filename"),
    sizeBytes: integer("size_bytes"),
    stoppedContainers: integer("stopped_containers").notNull().default(0),
    stopErrors: integer("stop_errors").notNull().default(0),
    localStatus: text("local_status", {
      enum: ["success", "failure", "skipped"],
    }),
    s3Status: text("s3_status", {
      enum: ["success", "failure", "skipped"],
    }),
    error: text("error"),
    receivedAt: integer("received_at").notNull(),
  },
  (table) => [
    index("backup_runs_started_at_idx").on(table.startedAt),
    index("backup_runs_source_idx").on(table.source),
  ],
);
