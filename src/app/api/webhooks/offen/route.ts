import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { insertBackupRun } from "@/lib/db/backup-runs";
import { normalizeBackupPayload } from "@/lib/integrations/backup";
import type { BackupSource } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

function safeEqual(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function normalizeSourceHeader(value: string | null): BackupSource | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (v === "local") return "local";
  if (v === "cloudflare") return "cloudflare";
  return null;
}

function jsonError(status: number, error: string) {
  return NextResponse.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  const token = request.headers.get("X-Nerve-Token") ?? "";
  const expected = process.env.OFFEN_WEBHOOK_TOKEN ?? "";
  if (!safeEqual(token, expected)) {
    return jsonError(401, "unauthorized");
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return jsonError(400, "malformed");
  }

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return jsonError(400, "malformed");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonError(400, "malformed");
  }

  const source = normalizeSourceHeader(request.headers.get("X-Nerve-Source"));

  const run = normalizeBackupPayload(body, {
    source,
    receivedAt: Date.now(),
  });
  if (!run) {
    return jsonError(400, "malformed");
  }

  try {
    const id = insertBackupRun(run);
    return NextResponse.json(
      { ok: true, id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return jsonError(500, "storage");
  }
}
